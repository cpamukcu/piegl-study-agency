import type { MeetingTime } from "@/db/meetings";
import type { Term } from "@/db/terms";
import { DAY_MS, MINUTE_MS, formatClock, shanghaiToMs, startOfShanghaiWeek, weekdayName } from "@/lib/time";

const WEEK_MS = 7 * DAY_MS;

export type ClassSession = {
  courseId: string;
  meetingTimeId: string;
  week: number | null;
  startsAt: number;
  endsAt: number;
  room: string | null;
};

export function weekOneMonday(term: Pick<Term, "startDate">): number {
  return startOfShanghaiWeek(shanghaiToMs(term.startDate));
}

export function teachingWeek(term: Pick<Term, "startDate">, ms: number): number {
  return Math.floor((ms - weekOneMonday(term)) / WEEK_MS) + 1;
}

export function sessionsBetween(meetings: MeetingTime[], terms: Term[], fromMs: number, toMs: number): ClassSession[] {
  const termById = new Map(terms.map((t) => [t.id, t]));
  const out: ClassSession[] = [];
  const push = (m: MeetingTime, monday: number, week: number | null) => {
    const day = monday + (m.weekday - 1) * DAY_MS;
    const startsAt = day + m.startMinute * MINUTE_MS;
    if (startsAt < fromMs || startsAt >= toMs) return;
    out.push({ courseId: m.courseId, meetingTimeId: m.id, week, startsAt, endsAt: day + m.endMinute * MINUTE_MS, room: m.room });
  };

  for (const m of meetings) {
    const term = m.termId ? termById.get(m.termId) : undefined;
    if (term) {
      const first = weekOneMonday(term);
      const weeks = m.weeks.length ? m.weeks : Array.from({ length: term.weeks }, (_, i) => i + 1);
      for (const week of weeks) push(m, first + (week - 1) * WEEK_MS, week);
    } else {
      for (let monday = startOfShanghaiWeek(fromMs); monday < toMs; monday += WEEK_MS) push(m, monday, null);
    }
  }
  return out.sort((a, b) => a.startsAt - b.startsAt);
}

export function compressWeeks(weeks: number[]): string {
  const sorted = [...new Set(weeks)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j - i >= 2 ? `${sorted[i]}–${sorted[j]}` : sorted.slice(i, j + 1).join(", "));
    i = j + 1;
  }
  return parts.join(", ");
}

export function describeMeeting(m: MeetingTime): string {
  const parts = [`${weekdayName(m.weekday)} ${formatClock(m.startMinute)}–${formatClock(m.endMinute)}`];
  if (m.room) parts.push(m.room);
  if (m.weeks.length) parts.push(`weeks ${compressWeeks(m.weeks)}`);
  return parts.join(" · ");
}

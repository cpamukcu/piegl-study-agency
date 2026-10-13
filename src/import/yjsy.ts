import type { Term } from "@/db/terms";
import type { YjsySnapshot } from "@/import/schemas";
import { hhmmToMinutes } from "@/lib/time";

export type ImportedMeeting = {
  externalId: string;
  classNo: string;
  courseTitle: string;
  teacher: string | null;
  weekday: number;
  startMinute: number;
  endMinute: number;
  room: string | null;
  weeks: number[];
};

export type ImportedNoticeCourse = { classNo: string; title: string; teacher: string | null; note: string | null };

export function parseWeeks(value: string): number[] {
  const weeks = value
    .split(/[,，\s]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(weeks)].sort((a, b) => a - b);
}

export function mapYjsy(snapshot: YjsySnapshot): {
  term: Term;
  meetings: ImportedMeeting[];
  noticeCourses: ImportedNoticeCourse[];
  skipped: number;
} {
  const { calendar } = snapshot;
  const periods = calendar.periods
    .map((p) => ({ period: p.period, startMinute: hhmmToMinutes(p.start), endMinute: hhmmToMinutes(p.end) }))
    .sort((a, b) => a.period - b.period);
  const byPeriod = new Map(periods.map((p) => [p.period, p]));
  const term: Term = {
    id: `yjsy:${calendar.year}-${calendar.term_code}`,
    name: `${calendar.year}–${Number(calendar.year) + 1}`,
    startDate: calendar.start,
    weeks: calendar.weeks,
    periods,
  };

  const meetings: ImportedMeeting[] = [];
  let skipped = 0;
  for (const c of snapshot.classes) {
    const start = byPeriod.get(c.start_period);
    const end = byPeriod.get(c.end_period);
    if (!start || !end || end.endMinute <= start.startMinute) {
      skipped += 1;
      continue;
    }
    const weeks = parseWeeks(c.weeks);
    meetings.push({
      externalId: `yjsy:${c.class_no}:${c.weekday}:${c.start_period}-${c.end_period}:${weeks.join(".")}`,
      classNo: c.class_no,
      courseTitle: c.course,
      teacher: c.teacher,
      weekday: c.weekday,
      startMinute: start.startMinute,
      endMinute: end.endMinute,
      room: c.room ?? c.building ?? null,
      weeks,
    });
  }

  const noticeCourses = snapshot.notices.map((n) => ({ classNo: n.class_no, title: n.course, teacher: n.teacher, note: n.note }));
  return { term, meetings, noticeCourses, skipped };
}

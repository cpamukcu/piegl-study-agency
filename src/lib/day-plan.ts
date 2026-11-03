// Presentation helpers for the daily views. They only read existing tasks and
// class sessions; nothing here changes data.
import { isOpen, type Task } from "@/db/tasks";
import type { ClassSession } from "@/lib/sessions";
import { DAY_MS, MINUTE_MS, formatClock, formatMinutes, shanghaiParts, startOfShanghaiDay, startOfShanghaiWeek } from "@/lib/time";

const LONG_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

export function greeting(now: number): string {
  const { hour } = shanghaiParts(now);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

// "Monday, 13 October"
export function formatLongDate(ms: number): string {
  const p = shanghaiParts(ms);
  return `${LONG_WEEKDAYS[p.weekday - 1]}, ${p.day} ${LONG_MONTHS[p.month - 1]}`;
}

// "2026-10-13", the Shanghai calendar date, for links.
export function dateKey(ms: number): string {
  const p = shanghaiParts(ms);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function clockOf(ms: number): string {
  const p = shanghaiParts(ms);
  return formatClock(p.hour * 60 + p.minute);
}

// "In 42 min", "In 2 h 10 min"; null once the time has passed or is 12 hours or more away.
export function timeUntil(ms: number, now: number): string | null {
  const diff = ms - now;
  if (diff <= 0 || diff >= DAY_MS / 2) return null;
  return `In ${formatMinutes(Math.max(1, Math.round(diff / MINUTE_MS)))}`;
}

export type Urgency = "overdue" | "today" | "tomorrow" | "week" | "later";

export function urgencyOf(dueAt: number, now: number): Urgency {
  if (dueAt < now) return "overdue";
  const days = Math.round((startOfShanghaiDay(dueAt) - startOfShanghaiDay(now)) / DAY_MS);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return dueAt < startOfShanghaiWeek(now) + 7 * DAY_MS ? "week" : "later";
}

// Words for a deadline's urgency, so colour is never the only signal.
export function urgencyLabel(dueAt: number, now: number): string {
  const days = Math.round((startOfShanghaiDay(dueAt) - startOfShanghaiDay(now)) / DAY_MS);
  if (dueAt < now) return "Overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? "In 1 week" : `In ${weeks} weeks`;
}

// Share of a one-week countdown already used: 0 a week or more ahead, 1 at the deadline.
export function countdownFraction(dueAt: number, now: number): number {
  const left = (dueAt - now) / (7 * DAY_MS);
  return Math.min(1, Math.max(0, 1 - left));
}

export type Progress = { done: number; total: number; scope: "today" | "this week" };

// Tasks due today that are done, or, on a day with nothing due, the same for this week.
export function dayProgress(tasks: Task[], now: number): Progress {
  const count = (from: number, to: number) => {
    const due = tasks.filter((t) => t.dueAt !== null && t.dueAt >= from && t.dueAt < to);
    return { done: due.filter((t) => !isOpen(t)).length, total: due.length };
  };
  const day = startOfShanghaiDay(now);
  const today = count(day, day + DAY_MS);
  if (today.total > 0) return { ...today, scope: "today" };
  const week = startOfShanghaiWeek(now);
  return { ...count(week, week + 7 * DAY_MS), scope: "this week" };
}

// Estimated minutes of open work that is due today or already overdue.
export function plannedMinutesToday(tasks: Task[], now: number): number {
  const end = startOfShanghaiDay(now) + DAY_MS;
  return tasks
    .filter((t) => isOpen(t) && t.dueAt !== null && t.dueAt < end)
    .reduce((sum, t) => sum + (t.estMinutes ?? 0), 0);
}

export type TimelineKind = "class" | "study" | "deadline";
export type TimelineStatus = "past" | "now" | "next" | "upcoming" | "done" | "overdue";

export type TimelineEvent = {
  key: string;
  kind: TimelineKind;
  startsAt: number;
  endsAt: number | null;
  courseId: string | null;
  title: string | null; // null for a class: the course name is its title
  room: string | null;
  status: TimelineStatus;
};

// One day's classes and due tasks, in time order. Class prep counts as planned study.
export function dayTimeline(dayStart: number, sessions: ClassSession[], tasks: Task[], now: number): TimelineEvent[] {
  const dayEnd = dayStart + DAY_MS;
  const events: TimelineEvent[] = [];

  for (const s of sessions) {
    if (s.startsAt < dayStart || s.startsAt >= dayEnd) continue;
    const status: TimelineStatus = s.endsAt <= now ? "past" : s.startsAt <= now ? "now" : "upcoming";
    events.push({
      key: `class-${s.meetingTimeId}-${s.startsAt}`,
      kind: "class",
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      courseId: s.courseId,
      title: null,
      room: s.room,
      status,
    });
  }

  for (const t of tasks) {
    if (t.dueAt === null || t.dueAt < dayStart || t.dueAt >= dayEnd) continue;
    const status: TimelineStatus = !isOpen(t) ? "done" : t.dueAt < now ? "overdue" : "upcoming";
    events.push({
      key: `task-${t.id}`,
      kind: t.type === "prep" ? "study" : "deadline",
      startsAt: t.dueAt,
      endsAt: null,
      courseId: t.courseId,
      title: t.title,
      room: null,
      status,
    });
  }

  events.sort((a, b) => a.startsAt - b.startsAt || (a.kind === "class" ? -1 : 1));
  const next = events.find((e) => e.status === "upcoming");
  if (next && !events.some((e) => e.status === "now")) next.status = "next";
  return events;
}

export function durationLabel(startsAt: number, endsAt: number): string {
  return formatMinutes(Math.round((endsAt - startsAt) / MINUTE_MS));
}

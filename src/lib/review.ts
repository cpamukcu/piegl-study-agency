// Weekly Review: what happened this week, and a realistic plan for next week that never schedules work after its deadline.
import { isOpen, type Task } from "@/db/tasks";
import { DAY_MS, shanghaiParts, startOfShanghaiDay } from "@/lib/time";

const WEEK_MS = 7 * DAY_MS;
export const DEFAULT_DAILY_MINUTES = 180;
export const UNESTIMATED_MINUTES = 60;

export type WeekSummary = { done: Task[]; postponed: Task[]; overdue: Task[]; dueNextWeek: Task[] };

export function summarizeWeek(tasks: Task[], weekStart: number, now: number): WeekSummary {
  const weekEnd = weekStart + WEEK_MS;
  const inWeek = (ms: number | null) => ms !== null && ms >= weekStart && ms < weekEnd;
  return {
    done: tasks.filter((t) => t.status === "done" && inWeek(t.completedAt)),
    postponed: tasks.filter((t) => t.status === "postponed" && inWeek(t.updatedAt)),
    overdue: tasks.filter((t) => isOpen(t) && t.dueAt !== null && t.dueAt < Math.min(now, weekEnd)),
    dueNextWeek: tasks.filter((t) => isOpen(t) && t.dueAt !== null && t.dueAt >= weekEnd && t.dueAt < weekEnd + WEEK_MS),
  };
}

export type PlanItem = { taskId: string; title: string; day: number; minutes: number; dueAt: number | null; overCapacity: boolean };

// Last day index (0 = Monday) of the planned week on which a task can still be worked on.
// Work due before noon has to be finished the day before. Already overdue or due early: Monday.
export function latestDay(task: Pick<Task, "dueAt">, weekStart: number): number {
  if (task.dueAt === null) return 6;
  const day = Math.floor((startOfShanghaiDay(task.dueAt) - weekStart) / DAY_MS);
  const beforeNoon = shanghaiParts(task.dueAt).hour < 12;
  return Math.max(0, Math.min(6, day - (beforeNoon ? 1 : 0)));
}

// Tasks worth planning: open, not class prep (the prep routine handles that), due by the end of the week or undated but important.
export function planCandidates(tasks: Task[], weekStart: number): Task[] {
  const weekEnd = weekStart + WEEK_MS;
  return tasks.filter((t) => isOpen(t) && t.type !== "prep" && (t.dueAt === null ? t.importance === 3 : t.dueAt < weekEnd));
}

// Earliest deadline first; each task goes on the earliest day, up to its last possible day, that still has room.
export function suggestPlan(tasks: Task[], weekStart: number, dailyMinutes = DEFAULT_DAILY_MINUTES): PlanItem[] {
  const left = Array.from({ length: 7 }, () => dailyMinutes);
  const ordered = [...planCandidates(tasks, weekStart)].sort(
    (a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || b.importance - a.importance || a.title.localeCompare(b.title),
  );
  const plan: PlanItem[] = [];
  for (const task of ordered) {
    const minutes = task.estMinutes ?? UNESTIMATED_MINUTES;
    const last = latestDay(task, weekStart);
    let day = -1;
    for (let d = 0; d <= last; d++) {
      if (left[d] >= minutes) {
        day = d;
        break;
      }
    }
    let overCapacity = false;
    if (day === -1) {
      if (task.dueAt === null) continue; // No room this week for undated work; it can wait.
      day = 0;
      for (let d = 1; d <= last; d++) if (left[d] > left[day]) day = d;
      overCapacity = true;
    }
    left[day] -= minutes;
    plan.push({ taskId: task.id, title: task.title, day, minutes, dueAt: task.dueAt, overCapacity });
  }
  return plan.sort((a, b) => a.day - b.day || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
}

export type SavedPlanItem = { taskId: string; title: string; day: number };

// Refuses any item placed after the last day it can be worked on.
export function checkPlan(items: { taskId: string; day: number }[], tasks: Task[], weekStart: number): Record<string, string> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const errors: Record<string, string> = {};
  for (const item of items) {
    const task = byId.get(item.taskId);
    if (!task) {
      errors[item.taskId] = "This task no longer exists.";
      continue;
    }
    if (!Number.isInteger(item.day) || item.day < 0 || item.day > 6) errors[item.taskId] = "Pick a day.";
    else if (item.day > latestDay(task, weekStart)) errors[item.taskId] = `${task.title} is due before then. Plan it earlier.`;
  }
  return errors;
}

export function weekLabel(weekStart: number): string {
  const a = shanghaiParts(weekStart);
  const b = shanghaiParts(weekStart + 6 * DAY_MS);
  const month = (m: number) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return a.month === b.month ? `${a.day}–${b.day} ${month(a.month)}` : `${a.day} ${month(a.month)} – ${b.day} ${month(b.month)}`;
}

// Shanghai has no daylight saving time, so days are always 24 hours.
export const dayStart = (weekStart: number, day: number) => weekStart + day * DAY_MS;

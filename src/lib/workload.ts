import { isOpen, type Task } from "@/db/tasks";
import { DAY_MS, formatMinutes, startOfShanghaiWeek } from "@/lib/time";

export type WeekLoad = { weekStart: number; minutes: number; tasks: number; unestimated: number };

export function weeklyWorkload(tasks: Task[], now: number, weeks = 4): WeekLoad[] {
  const first = startOfShanghaiWeek(now);
  const out: WeekLoad[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: first + i * 7 * DAY_MS,
    minutes: 0,
    tasks: 0,
    unestimated: 0,
  }));
  for (const task of tasks) {
    if (!isOpen(task) || task.dueAt === null) continue;
    // Overdue work still has to be done, so it counts toward this week.
    const index = task.dueAt < first ? 0 : Math.floor((task.dueAt - first) / (7 * DAY_MS));
    const week = out[index];
    if (!week) continue;
    week.tasks += 1;
    if (task.estMinutes === null) week.unestimated += 1;
    else week.minutes += task.estMinutes;
  }
  return out;
}

export function describeLoad(week: WeekLoad): string {
  if (week.tasks === 0) return "No tasks";
  const parts: string[] = [];
  if (week.minutes > 0) parts.push(formatMinutes(week.minutes));
  parts.push(`${week.tasks} ${week.tasks === 1 ? "task" : "tasks"}`);
  if (week.unestimated > 0) parts.push(`${week.unestimated} without estimate`);
  return parts.join(" · ");
}

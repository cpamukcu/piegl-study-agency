import { isOpen, type Task } from "@/db/tasks";
import { DAY_MS, startOfShanghaiWeek } from "@/lib/time";

export type TaskGroups = {
  overdue: Task[];
  thisWeek: Task[];
  later: Task[];
  noDate: Task[];
  doneRecently: Task[];
};

const byDue = (a: Task, b: Task) => (a.dueAt ?? 0) - (b.dueAt ?? 0);

export function groupTasks(tasks: Task[], now: number): TaskGroups {
  const weekEnd = startOfShanghaiWeek(now) + 7 * DAY_MS;
  const groups: TaskGroups = { overdue: [], thisWeek: [], later: [], noDate: [], doneRecently: [] };
  for (const task of tasks) {
    if (!isOpen(task)) {
      if (task.completedAt !== null && task.completedAt >= now - 7 * DAY_MS) groups.doneRecently.push(task);
    } else if (task.dueAt === null) {
      groups.noDate.push(task);
    } else if (task.dueAt < now) {
      groups.overdue.push(task);
    } else if (task.dueAt < weekEnd) {
      groups.thisWeek.push(task);
    } else {
      groups.later.push(task);
    }
  }
  groups.overdue.sort(byDue);
  groups.thisWeek.sort(byDue);
  groups.later.sort(byDue);
  groups.doneRecently.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  return groups;
}

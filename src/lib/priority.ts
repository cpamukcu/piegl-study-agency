import { isOpen, type Task } from "@/db/tasks";
import { DAY_MS, MINUTE_MS, formatDue, humanDuration } from "@/lib/time";

export type ScoredTask = { task: Task; score: number; reasons: string[] };

function dueReason(dueAt: number, now: number): string {
  return `Due ${formatDue(dueAt, now).replace(/^(Today|Tomorrow|Yesterday)/, (word) => word.toLowerCase())}`;
}

export function scoreTask(task: Task, now: number): ScoredTask | null {
  if (!isOpen(task)) return null;
  const reasons: string[] = [];
  let score: number;

  if (task.dueAt === null) {
    score = task.importance * 5;
    reasons.push("No deadline");
  } else if (task.dueAt < now) {
    score = 100 + task.importance * 10;
    reasons.push(`Overdue by ${humanDuration(now - task.dueAt)}`);
  } else {
    const daysLeft = (task.dueAt - now) / DAY_MS;
    score = 40 / (daysLeft + 1) + task.importance * 8;
    reasons.push(dueReason(task.dueAt, now));
    if (task.estMinutes !== null && daysLeft < 3) {
      score += Math.min(task.estMinutes / 60, 4) * 4;
      reasons.push(`Needs about ${humanDuration(task.estMinutes * MINUTE_MS)}`);
    }
  }

  if (task.importance === 3) reasons.push("Marked important");
  return { task, score, reasons };
}

export function rankTasks(tasks: Task[], now: number): ScoredTask[] {
  return tasks
    .map((task) => scoreTask(task, now))
    .filter((scored): scored is ScoredTask => scored !== null)
    .sort((a, b) => b.score - a.score || (a.task.dueAt ?? Infinity) - (b.task.dueAt ?? Infinity));
}

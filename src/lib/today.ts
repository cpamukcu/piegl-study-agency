import { isOpen, type Task } from "@/db/tasks";
import { rankTasks, type ScoredTask } from "@/lib/priority";
import type { ClassSession } from "@/lib/sessions";

export type TodayView = {
  dueNext: Task[];
  overdueCount: number;
  nextSession: ClassSession | null;
  prepTask: Task | null;
  top: ScoredTask | null;
};

export function buildToday(tasks: Task[], sessions: ClassSession[], now: number): TodayView {
  const open = tasks.filter(isOpen);
  const dueNext = open
    .filter((t): t is Task & { dueAt: number } => t.dueAt !== null && t.dueAt >= now)
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, 3);
  const overdueCount = open.filter((t) => t.dueAt !== null && t.dueAt < now).length;
  const nextSession = sessions.find((s) => s.startsAt > now) ?? null;
  const prepTask = nextSession
    ? (tasks.find((t) => t.type === "prep" && t.courseId === nextSession.courseId && t.occurrenceKey === String(nextSession.startsAt)) ?? null)
    : null;
  return { dueNext, overdueCount, nextSession, prepTask, top: rankTasks(open, now)[0] ?? null };
}

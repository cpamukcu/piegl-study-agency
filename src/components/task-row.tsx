import { postponeTaskAction, setTaskStatusAction } from "@/app/actions";
import { CourseBadge } from "@/components/course-dot";
import { Icon } from "@/components/icons";
import { PriorityPill, StatusPill } from "@/components/priority-pill";
import { TaskCheck } from "@/components/task-check";
import { TaskEditor } from "@/components/task-editor";
import { BUTTON_GHOST, CARD } from "@/components/ui";
import type { Course } from "@/db/courses";
import type { Task } from "@/db/tasks";
import { TASK_TYPE_LABELS } from "@/lib/labels";
import { MINUTE_MS, formatDue, humanDuration } from "@/lib/time";

type TaskRowProps = { task: Task; course: Course | null; now: number };

export function TaskRow({ task, course, now }: TaskRowProps) {
  const done = task.status === "done";
  const overdue = !done && task.dueAt !== null && task.dueAt < now;

  return (
    <li className="flex gap-3.5 border-b border-line py-4 first:pt-2 last:border-b-0 last:pb-1">
      <form action={setTaskStatusAction} className="pt-0.5">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="status" value={done ? "todo" : "done"} />
        <TaskCheck done={done} title={task.title} />
      </form>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={`text-[15px] font-semibold leading-snug ${done ? "text-faint line-through decoration-faint/60" : "text-ink"}`}>{task.title}</p>
            <p className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium ${done ? "text-faint" : "text-ink-muted"}`}>
              <CourseBadge course={course} />
              <span>{TASK_TYPE_LABELS[task.type]}</span>
              {task.dueAt !== null && (
                <span className={`inline-flex items-center gap-1 ${overdue ? "font-semibold text-coral-ink" : ""}`}>
                  <Icon name={overdue ? "flag" : "clock"} className="size-3.5" />
                  <span>{overdue ? `Overdue · ${formatDue(task.dueAt, now)}` : formatDue(task.dueAt, now)}</span>
                </span>
              )}
              {task.estMinutes !== null && <span>about {humanDuration(task.estMinutes * MINUTE_MS)}</span>}
              {!done && <PriorityPill importance={task.importance} />}
              {task.status === "postponed" && <StatusPill tone="amber">Postponed</StatusPill>}
            </p>
          </div>
          {!done && (
            <form action={postponeTaskAction} className="shrink-0">
              <input type="hidden" name="id" value={task.id} />
              <button type="submit" className={`${BUTTON_GHOST} px-2.5 py-1.5 text-[13px]`} aria-label={`Postpone "${task.title}" by one day`} title="Postpone by one day">
                +1 day
              </button>
            </form>
          )}
        </div>
        {task.notes && <p className="mt-1.5 max-w-prose text-sm text-body">{task.notes}</p>}
        <TaskEditor task={task} />
      </div>
    </li>
  );
}

type TaskSectionProps = { id: string; title: string; tasks: Task[]; courseById: Map<string, Course>; now: number; tone?: "default" | "urgent" };

export function TaskSection({ id, title, tasks, courseById, now, tone = "default" }: TaskSectionProps) {
  return (
    <section aria-labelledby={`${id}-heading`} className={`${CARD} ${tone === "urgent" ? "bg-[#fff8fb] ring-coral/25" : ""}`}>
      <h2 id={`${id}-heading`} className="flex items-center gap-2 text-lg">
        {title} <span className="text-sm font-semibold text-ink-muted">({tasks.length})</span>
      </h2>
      <ul className="mt-2">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} course={task.courseId ? (courseById.get(task.courseId) ?? null) : null} now={now} />
        ))}
      </ul>
    </section>
  );
}

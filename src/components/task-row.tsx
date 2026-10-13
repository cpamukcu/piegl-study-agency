import { postponeTaskAction, setTaskStatusAction } from "@/app/actions";
import { CourseDot } from "@/components/course-dot";
import { TaskEditor } from "@/components/task-editor";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD } from "@/components/ui";
import type { Course } from "@/db/courses";
import type { Task } from "@/db/tasks";
import { TASK_TYPE_LABELS } from "@/lib/labels";
import { MINUTE_MS, formatDue, humanDuration } from "@/lib/time";

type TaskRowProps = { task: Task; course: Course | null; now: number };

export function TaskRow({ task, course, now }: TaskRowProps) {
  const done = task.status === "done";
  const overdue = !done && task.dueAt !== null && task.dueAt < now;

  return (
    <li className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className={`font-medium ${done ? "text-ink-muted line-through" : ""}`}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {course && (
            <span className="inline-flex items-center gap-1.5">
              <CourseDot color={course.color} />
              {course.title}
            </span>
          )}
          <span>{TASK_TYPE_LABELS[task.type]}</span>
          {task.dueAt !== null && (
            <span className={overdue ? "font-medium text-warn" : undefined}>
              {overdue ? `Overdue · ${formatDue(task.dueAt, now)}` : formatDue(task.dueAt, now)}
            </span>
          )}
          {task.estMinutes !== null && <span>about {humanDuration(task.estMinutes * MINUTE_MS)}</span>}
          {task.importance === 3 && <span>Important</span>}
          {task.status === "postponed" && <span>Postponed</span>}
        </p>
        {task.notes && <p className="mt-1 max-w-prose text-sm text-ink-muted">{task.notes}</p>}
        <TaskEditor task={task} />
      </div>
      <div className="flex shrink-0 gap-2">
        {done ? (
          <form action={setTaskStatusAction}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="status" value="todo" />
            <button type="submit" className={BUTTON_SECONDARY} aria-label={`Reopen "${task.title}"`}>
              Reopen
            </button>
          </form>
        ) : (
          <>
            <form action={setTaskStatusAction}>
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="status" value="done" />
              <button type="submit" className={BUTTON_PRIMARY} aria-label={`Mark "${task.title}" done`}>
                Done
              </button>
            </form>
            <form action={postponeTaskAction}>
              <input type="hidden" name="id" value={task.id} />
              <button type="submit" className={BUTTON_SECONDARY} aria-label={`Postpone "${task.title}" by one day`}>
                +1 day
              </button>
            </form>
          </>
        )}
      </div>
    </li>
  );
}

type TaskSectionProps = { id: string; title: string; tasks: Task[]; courseById: Map<string, Course>; now: number };

export function TaskSection({ id, title, tasks, courseById, now }: TaskSectionProps) {
  return (
    <section aria-labelledby={`${id}-heading`} className={CARD}>
      <h2 id={`${id}-heading`} className="font-serif text-lg">
        {title} <span className="text-sm text-ink-muted">({tasks.length})</span>
      </h2>
      <ul className="mt-2">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} course={task.courseId ? (courseById.get(task.courseId) ?? null) : null} now={now} />
        ))}
      </ul>
    </section>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icons";
import { TaskForm } from "@/components/task-form";
import { TaskSection } from "@/components/task-row";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { materializePrepTasks } from "@/db/rules";
import { isOpen, listTasks, type Task } from "@/db/tasks";
import { requestTime } from "@/lib/clock";
import { groupTasks } from "@/lib/deadline-groups";
import { DAY_MS, startOfShanghaiDay } from "@/lib/time";

export const TASK_VIEWS = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
] as const;
type ViewId = (typeof TASK_VIEWS)[number]["id"];

type Search = { view?: string | string[] };

const byDue = (a: Task, b: Task) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity);

// Today: open work due today or already overdue. Upcoming: everything open after today.
// Completed: done in the last 7 days. The same split as Deadlines, seen as a to-do list.
export function splitTasks(tasks: Task[], now: number) {
  const endOfToday = startOfShanghaiDay(now) + DAY_MS;
  const open = tasks.filter(isOpen);
  return {
    overdue: open.filter((t) => t.dueAt !== null && t.dueAt < now).sort(byDue),
    today: open.filter((t) => t.dueAt !== null && t.dueAt >= now && t.dueAt < endOfToday).sort(byDue),
    upcoming: open.filter((t) => t.dueAt !== null && t.dueAt >= endOfToday).sort(byDue),
    noDate: open.filter((t) => t.dueAt === null),
    completed: groupTasks(tasks, now).doneRecently,
  };
}

export async function TasksData({ searchParams }: { searchParams?: Promise<Search> } = {}) {
  const search = (await searchParams) ?? {};
  await connection();
  const db = getDb();
  const now = requestTime();
  materializePrepTasks(db, now);

  const courses = listCourses(db);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const split = splitTasks(listTasks(db, { includeDone: true }), now);
  const raw = Array.isArray(search.view) ? search.view[0] : search.view;
  const view: ViewId = TASK_VIEWS.some((v) => v.id === raw) ? (raw as ViewId) : "today";
  const counts: Record<ViewId, number> = {
    today: split.overdue.length + split.today.length,
    upcoming: split.upcoming.length + split.noDate.length,
    completed: split.completed.length,
  };
  const sections = {
    today: [
      { id: "overdue", title: "Overdue", tasks: split.overdue, tone: "urgent" as const },
      { id: "due-today", title: "Due today", tasks: split.today, tone: "default" as const },
    ],
    upcoming: [
      { id: "upcoming", title: "Coming up", tasks: split.upcoming, tone: "default" as const },
      { id: "no-date", title: "No date", tasks: split.noDate, tone: "default" as const },
    ],
    completed: [{ id: "completed", title: "Done in the last 7 days", tasks: split.completed, tone: "default" as const }],
  }[view].filter((s) => s.tasks.length > 0);

  return (
    <div className="space-y-6">
      <nav aria-label="Task views" className="inline-flex rounded-full bg-surface-soft p-1 ring-1 ring-line">
        {TASK_VIEWS.map((v) => {
          const active = v.id === view;
          return (
            <Link
              key={v.id}
              href={v.id === "today" ? "/tasks" : `/tasks?view=${v.id}`}
              aria-current={active ? "page" : undefined}
              aria-label={`${v.label} (${counts[v.id]})`}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active ? "bg-white text-ink shadow-card" : "text-ink-muted hover:text-ink"
              }`}
            >
              {v.label}
              <span className={`rounded-full px-1.5 text-xs ${active ? "bg-lavender-50 text-accent" : "text-faint"}`}>{counts[v.id]}</span>
            </Link>
          );
        })}
      </nav>

      {sections.length ? (
        sections.map((s) => <TaskSection key={s.id} id={s.id} title={s.title} tasks={s.tasks} courseById={courseById} now={now} tone={s.tone} />)
      ) : (
        <EmptyState
          title={view === "today" ? "Nothing due today" : view === "upcoming" ? "Nothing coming up" : "Nothing completed yet"}
          art={view === "completed" ? "sparkle" : "calendar"}
        >
          {view === "today"
            ? "You’re clear for today. Look at what’s coming up, or add a task below."
            : view === "upcoming"
              ? "Add a task below, or import your ZJU snapshots in Settings."
              : "Tasks you finish show here for a week."}
        </EmptyState>
      )}

      <TaskForm courses={courses.map((c) => ({ id: c.id, title: c.title }))} />

      {/* Phone: a floating add button above the tab bar. */}
      <a
        href="#new-task"
        aria-label="Add task"
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-5 z-20 inline-flex size-14 items-center justify-center rounded-full bg-action text-white shadow-lift transition active:scale-95 md:hidden"
      >
        <Icon name="plus" className="size-6" strokeWidth={2.2} />
      </a>
    </div>
  );
}

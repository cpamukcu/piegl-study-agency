import Link from "next/link";
import { connection } from "next/server";
import { CourseDot } from "@/components/course-dot";
import { EmptyState } from "@/components/empty-state";
import { TaskForm } from "@/components/task-form";
import { TaskSection } from "@/components/task-row";
import { WorkloadChart } from "@/components/workload-chart";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { materializePrepTasks } from "@/db/rules";
import { listTasks, type Task } from "@/db/tasks";
import { requestTime } from "@/lib/clock";
import { groupTasks } from "@/lib/deadline-groups";
import { DAY_MS, startOfShanghaiDay } from "@/lib/time";
import { weeklyWorkload } from "@/lib/workload";

type Search = { course?: string | string[]; sort?: string | string[] };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const byImportance = (a: Task, b: Task) => b.importance - a.importance || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity);
const CHIP = "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export async function DeadlinesData({ searchParams }: { searchParams?: Promise<Search> } = {}) {
  const search = (await searchParams) ?? {};
  await connection();
  const db = getDb();
  const now = requestTime();
  materializePrepTasks(db, now);

  const courses = listCourses(db);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const courseFilter = first(search.course);
  const activeCourse = courseFilter && courseById.has(courseFilter) ? courseFilter : null;
  const sort = first(search.sort) === "importance" ? "importance" : "date";
  const allTasks = listTasks(db, { includeDone: true });
  const tasks = activeCourse ? allTasks.filter((t) => t.courseId === activeCourse) : allTasks;
  const groups = groupTasks(tasks, now);
  const endOfToday = startOfShanghaiDay(now) + DAY_MS;
  const dueToday = groups.thisWeek.filter((t) => (t.dueAt as number) < endOfToday);
  const restOfWeek = groups.thisWeek.filter((t) => (t.dueAt as number) >= endOfToday);
  const openCount = groups.overdue.length + groups.thisWeek.length + groups.later.length + groups.noDate.length;
  const order = (list: Task[]) => (sort === "importance" ? [...list].sort(byImportance) : list);
  const sections = [
    { id: "overdue", title: "Overdue", tasks: order(groups.overdue), tone: "urgent" as const },
    { id: "due-today", title: "Due today", tasks: order(dueToday), tone: "urgent" as const },
    { id: "this-week", title: "This week", tasks: order(restOfWeek), tone: "default" as const },
    { id: "later", title: "Later", tasks: order(groups.later), tone: "default" as const },
    { id: "no-date", title: "No date", tasks: order(groups.noDate), tone: "default" as const },
    { id: "done-recently", title: "Done in the last 7 days", tasks: groups.doneRecently, tone: "default" as const },
  ].filter((s) => s.tasks.length > 0);

  const link = (course: string | null, s: string) => {
    const params = new URLSearchParams();
    if (course) params.set("course", course);
    if (s !== "date") params.set("sort", s);
    const q = params.toString();
    return q ? `/deadlines?${q}` : "/deadlines";
  };

  return (
    <div className="space-y-6">
      {courses.length > 0 && allTasks.length > 0 && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Filter by course" className="scroll-row -mx-5 flex gap-2 overflow-x-auto px-5 py-1 lg:mx-0 lg:flex-wrap lg:px-0">
            <Link
              href={link(null, sort)}
              aria-current={activeCourse === null ? "page" : undefined}
              className={`${CHIP} ${activeCourse === null ? "bg-pill text-ink ring-1 ring-lavender/40" : "bg-surface text-ink ring-1 ring-line hover:bg-tint"}`}
            >
              All courses
            </Link>
            {courses.map((c) => (
              <Link
                key={c.id}
                href={link(c.id, sort)}
                aria-current={activeCourse === c.id ? "page" : undefined}
                className={`${CHIP} ${activeCourse === c.id ? "bg-pill text-ink ring-1 ring-lavender/40" : "bg-surface text-ink ring-1 ring-line hover:bg-tint"}`}
              >
                <CourseDot color={c.color} />
                {c.title}
              </Link>
            ))}
          </nav>
          <nav aria-label="Sort" className="inline-flex shrink-0 self-start rounded-full bg-surface-soft p-1 ring-1 ring-line">
            {(["date", "importance"] as const).map((s) => (
              <Link
                key={s}
                href={link(activeCourse, s)}
                aria-current={sort === s ? "true" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${sort === s ? "bg-white text-ink shadow-card" : "text-ink-muted hover:text-ink"}`}
              >
                {s === "date" ? "By date" : "By importance"}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {openCount === 0 && (
            <EmptyState title="No deadlines yet" art="calendar">
              {activeCourse ? "Nothing for this course yet." : "Add a task, or import your ZJU snapshots in Settings."}
            </EmptyState>
          )}
          {sections.map((s) => (
            <TaskSection key={s.id} id={s.id} title={s.title} tasks={s.tasks} courseById={courseById} now={now} tone={s.tone} />
          ))}
        </div>
        <div className="space-y-6 lg:sticky lg:top-8">
          {openCount > 0 && <WorkloadChart weeks={weeklyWorkload(tasks, now)} />}
          <TaskForm courses={courses.map((c) => ({ id: c.id, title: c.title }))} defaultCourseId={activeCourse ?? ""} />
        </div>
      </div>
    </div>
  );
}

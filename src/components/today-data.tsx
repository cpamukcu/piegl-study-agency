import Link from "next/link";
import { connection } from "next/server";
import { CourseDot } from "@/components/course-dot";
import { EmptyState } from "@/components/empty-state";
import { CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { listCourses, type Course } from "@/db/courses";
import { listMeetingTimes } from "@/db/meetings";
import { listRules, materializePrepTasks } from "@/db/rules";
import { listTasks } from "@/db/tasks";
import { listTerms } from "@/db/terms";
import { requestTime } from "@/lib/clock";
import { sessionsBetween } from "@/lib/sessions";
import { groupTasks } from "@/lib/deadline-groups";
import { DAY_MS, formatDue, formatMinutes, startOfShanghaiDay } from "@/lib/time";
import { buildToday } from "@/lib/today";
import { weeklyWorkload } from "@/lib/workload";

const QUICK_ACTIONS = [
  { href: "/prepare", label: "Prepare next", icon: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /> },
  { href: "/deadlines#new-task", label: "Add task", icon: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8" /> },
  { href: "/practice", label: "Practice", icon: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /> },
  { href: "/settings", label: "Import ZJU", icon: <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /> },
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={CARD}>
      <h2 className="font-serif text-lg">{title}</h2>
      {children}
    </section>
  );
}

function CourseName({ course }: { course: Course | null }) {
  if (!course) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <CourseDot color={course.color} />
      {course.title}
    </span>
  );
}

export async function TodayData() {
  await connection();
  const db = getDb();
  const now = requestTime();
  materializePrepTasks(db, now);

  const courses = new Map(listCourses(db).map((c) => [c.id, c]));
  const courseOf = (id: string | null) => (id ? (courses.get(id) ?? null) : null);
  const sessions = sessionsBetween(listMeetingTimes(db), listTerms(db), now, now + 7 * DAY_MS);
  const tasks = listTasks(db, { includeDone: true });
  const view = buildToday(tasks, sessions, now);
  const thisWeek = groupTasks(tasks, now).thisWeek.length;
  const planned = weeklyWorkload(tasks, now, 1)[0]?.minutes ?? 0;
  const classesLeftToday = sessions.filter((s) => startOfShanghaiDay(s.startsAt) === startOfShanghaiDay(now)).length;
  const nextCourse = view.nextSession ? courseOf(view.nextSession.courseId) : null;
  const hasRoutine = nextCourse ? listRules(db, nextCourse.id).some((r) => r.active) : false;

  const stats = [
    { label: "due this week", value: String(thisWeek), warn: false },
    { label: "work planned", value: planned ? formatMinutes(planned) : "—", warn: false },
    { label: "classes left today", value: String(classesLeftToday), warn: false },
    { label: "overdue", value: String(view.overdueCount), warn: view.overdueCount > 0 },
  ];

  return (
    <div className="space-y-6">
    <dl aria-label="This week at a glance" className="-mt-14 relative grid grid-cols-2 overflow-hidden rounded-[20px] bg-surface shadow-soft md:grid-cols-4">
      {stats.map((stat, i) => (
        <div key={stat.label} className={`px-3 py-4 text-center ${i % 2 === 0 ? "border-r border-line" : ""} ${i < 2 ? "border-b border-line md:border-b-0" : ""} md:border-r md:last:border-r-0`}>
          <dd className={`text-2xl font-semibold ${stat.warn ? "text-warn" : ""}`}>{stat.value}</dd>
          <dt className="text-xs text-ink-muted">{stat.label}</dt>
        </div>
      ))}
    </dl>

    <nav aria-label="Quick actions" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {QUICK_ACTIONS.map((action, i) => (
        <Link
          key={action.href}
          href={action.href}
          className={`flex h-20 w-28 shrink-0 flex-col items-center justify-center gap-1.5 rounded-[18px] text-sm shadow-soft ${
            i === 0 ? "bg-hot font-semibold text-white" : "bg-surface text-accent"
          }`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {action.icon}
          </svg>
          {action.label}
        </Link>
      ))}
    </nav>

    <div className="grid gap-4 md:grid-cols-2">
      {view.dueNext.length === 0 && view.overdueCount === 0 ? (
        <EmptyState title="Due next">Nothing due yet. Add a course or a deadline and it will show here.</EmptyState>
      ) : (
        <Card title="Due next">
          {view.overdueCount > 0 && (
            <p className="mt-2 text-sm font-medium text-warn">
              <Link href="/deadlines" className="underline underline-offset-2">
                {view.overdueCount} overdue
              </Link>
            </p>
          )}
          <ul className="mt-2 space-y-3">
            {view.dueNext.map((task) => (
              <li key={task.id}>
                <p className="font-medium">{task.title}</p>
                <p className="flex flex-wrap gap-x-3 text-sm text-ink-muted">
                  <CourseName course={courseOf(task.courseId)} />
                  <span>{formatDue(task.dueAt as number, now)}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {view.nextSession && nextCourse ? (
        <Card title="Prepare next">
          <p className="mt-2 font-medium">
            <CourseName course={nextCourse} />
          </p>
          <p className="text-sm text-ink-muted">
            {[formatDue(view.nextSession.startsAt, now), view.nextSession.room].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-3 text-sm">
            {view.prepTask?.status === "done" ? (
              "Prep done"
            ) : view.prepTask ? (
              `Prep task due ${formatDue(view.prepTask.dueAt as number, now)}`
            ) : hasRoutine ? (
              "Prep routine is on for this course."
            ) : (
              <Link href={`/courses/${nextCourse.id}`} className="underline underline-offset-2">
                Add a prep routine
              </Link>
            )}
          </p>
        </Card>
      ) : (
        <EmptyState title="Prepare next">
          Your next class will show here. Add class times to a course, or import your ZJU timetable in Settings.
        </EmptyState>
      )}

      {view.top ? (
        <Card title="Highest-leverage task">
          <p className="mt-2 font-medium">{view.top.task.title}</p>
          <p className="text-sm text-ink-muted">
            <CourseName course={courseOf(view.top.task.courseId)} />
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-ink-muted">
            {view.top.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="Highest-leverage task">The one task worth doing first today, with the reason, will show here.</EmptyState>
      )}

      <EmptyState title="Confusing concepts">Concepts you mark as confusing in Prepare Class will collect here.</EmptyState>
    </div>
    </div>
  );
}

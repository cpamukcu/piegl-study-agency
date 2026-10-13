import Link from "next/link";
import { connection } from "next/server";
import { setTaskStatusAction } from "@/app/actions";
import { CourseBadge } from "@/components/course-dot";
import { DeadlineCard } from "@/components/deadline-card";
import { EmptyState } from "@/components/empty-state";
import { FocusDial, type FocusTask } from "@/components/focus-dial";
import { GradientHero } from "@/components/gradient-hero";
import { Icon } from "@/components/icons";
import { StatusPill } from "@/components/priority-pill";
import { QuickActions, type QuickAction } from "@/components/quick-actions";
import { ScheduleTimeline } from "@/components/schedule-timeline";
import { SectionHeader } from "@/components/section-header";
import { StatGrid } from "@/components/stat-grid";
import { TaskRow } from "@/components/task-row";
import { BUTTON_GHOST, BUTTON_PRIMARY, CARD, CARD_LG } from "@/components/ui";
import { getDb } from "@/db/connection";
import { listCourses, type Course } from "@/db/courses";
import { listMeetingTimes } from "@/db/meetings";
import { listRules, materializePrepTasks } from "@/db/rules";
import { isOpen, listTasks } from "@/db/tasks";
import { listTerms } from "@/db/terms";
import { requestTime } from "@/lib/clock";
import { clockOf, dayProgress, dayTimeline, plannedMinutesToday, timeUntil } from "@/lib/day-plan";
import { groupTasks } from "@/lib/deadline-groups";
import { rankTasks } from "@/lib/priority";
import { sessionsBetween } from "@/lib/sessions";
import { DAY_MS, MINUTE_MS, formatDue, formatMinutes, humanDuration, startOfShanghaiDay } from "@/lib/time";
import { buildToday } from "@/lib/today";
import { weeklyWorkload } from "@/lib/workload";

const QUICK_ACTIONS: QuickAction[] = [
  { href: "/tasks", label: "Plan my day", icon: "sparkle" },
  { href: "/deadlines#new-task", label: "Add task", icon: "plus-circle" },
  { href: "/prepare", label: "Prepare next", icon: "prepare" },
  { href: "/practice", label: "Practice", icon: "practice" },
  { href: "/settings", label: "Import ZJU", icon: "import" },
];

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function courseTint(course: Course): React.CSSProperties {
  return { backgroundColor: `color-mix(in srgb, ${course.color} 14%, white)`, color: course.color };
}

export async function TodayData() {
  await connection();
  const db = getDb();
  const now = requestTime();
  materializePrepTasks(db, now);

  const courses = listCourses(db);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const courseOf = (id: string | null) => (id ? (courseById.get(id) ?? null) : null);
  const meetings = listMeetingTimes(db);
  const terms = listTerms(db);
  const sessions = sessionsBetween(meetings, terms, now, now + 7 * DAY_MS);
  const tasks = listTasks(db, { includeDone: true });
  const view = buildToday(tasks, sessions, now);
  const thisWeek = groupTasks(tasks, now).thisWeek.length;
  const planned = weeklyWorkload(tasks, now, 1)[0]?.minutes ?? 0;
  const dayStart = startOfShanghaiDay(now);
  const classesLeftToday = sessions.filter((s) => startOfShanghaiDay(s.startsAt) === dayStart).length;
  const nextCourse = view.nextSession ? courseOf(view.nextSession.courseId) : null;
  const hasRoutine = nextCourse ? listRules(db, nextCourse.id).some((r) => r.active) : false;
  const progress = dayProgress(tasks, now);
  const plannedToday = plannedMinutesToday(tasks, now);
  const timeline = dayTimeline(dayStart, sessionsBetween(meetings, terms, dayStart, dayStart + DAY_MS), tasks, now);
  const dueToday = tasks.filter((t) => isOpen(t) && t.dueAt !== null && t.dueAt >= now && t.dueAt < dayStart + DAY_MS).length;
  const ranked = rankTasks(tasks, now);
  const focusTasks: FocusTask[] = ranked.slice(0, 6).map(({ task }) => {
    const course = courseOf(task.courseId);
    return {
      id: task.id,
      title: task.title,
      type: task.type,
      courseTitle: course?.title ?? null,
      courseColor: course?.color ?? null,
      estMinutes: task.estMinutes,
    };
  });
  const plan = [
    ...ranked.slice(0, 5).map((s) => s.task),
    ...tasks.filter((t) => !isOpen(t) && t.completedAt !== null && t.completedAt >= dayStart),
  ];

  const inClass = sessionsBetween(meetings, terms, dayStart, now + 1).find((s) => s.startsAt <= now && s.endsAt > now) ?? null;
  const inClassCourse = inClass ? courseOf(inClass.courseId) : null;
  const headline =
    view.overdueCount > 0
      ? `${plural(view.overdueCount, "task")} overdue. Let’s clear ${view.overdueCount === 1 ? "it" : "them"} first.`
      : inClass && inClassCourse
        ? `You’re in ${inClassCourse.title} until ${clockOf(inClass.endsAt)}.`
        : plannedToday > 0
        ? `About ${formatMinutes(plannedToday)} of planned work today.`
        : dueToday > 0
          ? `${plural(dueToday, "thing")} due today.`
          : classesLeftToday > 0
            ? `${plural(classesLeftToday, "class")} left on your timetable today.`
            : thisWeek > 0
              ? `Nothing due today. ${plural(thisWeek, "deadline")} later this week.`
              : "Nothing pressing today. A good day to get ahead.";
  const message = view.top
    ? `Start with ${view.top.task.title}.`
    : nextCourse && view.nextSession
      ? `Next up: ${nextCourse.title}, ${formatDue(view.nextSession.startsAt, now)}.`
      : "Add a deadline or import your ZJU snapshots to build your plan.";

  const stats = [
    { label: "Due this week", value: String(thisWeek), icon: "deadlines" as const, tint: "bg-lavender-50 text-lavender" },
    { label: "Planned this week", value: planned ? formatMinutes(planned) : "—", icon: "clock" as const, tint: "bg-sky-50 text-periwinkle" },
    { label: "Classes left today", value: String(classesLeftToday), icon: "book" as const, tint: "bg-mint-50 text-mint-ink" },
    {
      label: "Overdue",
      value: String(view.overdueCount),
      icon: "flag" as const,
      tint: view.overdueCount > 0 ? "bg-coral-50 text-coral-ink" : "bg-tint text-faint",
      warn: view.overdueCount > 0,
    },
  ];

  const nextIn = view.nextSession ? timeUntil(view.nextSession.startsAt, now) : null;

  return (
    <div className="space-y-9">
      <div>
        <GradientHero
          eyebrow="Today"
          headline={headline}
          message={message}
          progress={progress.total > 0 ? progress : null}
          action={view.top ? { href: "#focus-for-now", label: "Plan my next hour" } : { href: "/deadlines#new-task", label: "Add your first task" }}
          aside={
            nextCourse && view.nextSession ? (
              <div className="w-64 rounded-[20px] bg-white p-4 text-body shadow-lift">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Next class</p>
                <p className="mt-2 flex items-center gap-2 font-semibold text-ink">
                  <CourseBadge course={nextCourse} />
                </p>
                <p className="mt-1 text-[13px] font-medium text-ink-muted">{formatDue(view.nextSession.startsAt, now)}</p>
              </div>
            ) : undefined
          }
        />
        <div className="relative z-10 mx-3 -mt-9 sm:mx-6">
          <StatGrid stats={stats} label="This week at a glance" />
        </div>
      </div>

      <QuickActions actions={QUICK_ACTIONS} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
        {view.nextSession && nextCourse ? (
          <section aria-labelledby="up-next-heading" className={`${CARD_LG} relative overflow-hidden lg:col-start-1 lg:row-start-1`}>
            <span aria-hidden="true" className="absolute inset-y-6 left-0 w-1.5 rounded-r-full bg-action" />
            <div className="flex items-center justify-between gap-3">
              <h2 id="up-next-heading" className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                Up next
              </h2>
              {nextIn && <StatusPill tone={view.nextSession.startsAt - now < 15 * MINUTE_MS ? "amber" : "lavender"}>{nextIn}</StatusPill>}
            </div>
            <div className="mt-4 flex gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full" style={courseTint(nextCourse)}>
                <Icon name="book" className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-bold text-ink">{nextCourse.title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-body">
                  <Icon name="clock" className="size-4 text-faint" />
                  <span>Class starts {formatDue(view.nextSession.startsAt, now)}</span>
                </p>
                {view.nextSession.room && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-body">
                    <Icon name="pin" className="size-4 text-faint" />
                    <span>{view.nextSession.room}</span>
                  </p>
                )}
                <div className="mt-4 rounded-[16px] bg-surface-soft px-4 py-3 text-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Prepare</p>
                  <p className="mt-1 font-medium text-ink">
                    {view.prepTask?.status === "done" ? (
                      "Prep done"
                    ) : view.prepTask ? (
                      `${view.prepTask.title} · due ${formatDue(view.prepTask.dueAt as number, now)}`
                    ) : hasRoutine ? (
                      "Prep routine is on for this course."
                    ) : (
                      <Link href={`/courses/${nextCourse.id}`} className="text-accent underline decoration-lilac underline-offset-4">
                        Add a prep routine
                      </Link>
                    )}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {view.prepTask && view.prepTask.status !== "done" && (
                    <form action={setTaskStatusAction}>
                      <input type="hidden" name="id" value={view.prepTask.id} />
                      <input type="hidden" name="status" value="done" />
                      <button type="submit" className={BUTTON_PRIMARY}>
                        <Icon name="check" className="size-4" />
                        Mark prep done
                      </button>
                    </form>
                  )}
                  <Link href="/timetable" className={BUTTON_GHOST} aria-label="Open timetable" title="Open timetable">
                    <Icon name="timetable" className="size-4" />
                    Timetable
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="lg:col-start-1 lg:row-start-1">
            <EmptyState title="Up next" icon="book">
              Your next class will show here. Add class times to a course, or import your ZJU timetable in Settings.
            </EmptyState>
          </div>
        )}

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <FocusDial tasks={focusTasks} now={now} progress={progress.total > 0 ? progress : null} />
        </div>

        {view.top ? (
          <section
            id="best-next-step"
            aria-labelledby="best-next-step-heading"
            className="relative scroll-mt-8 overflow-hidden rounded-[24px] bg-wash p-5 shadow-card ring-1 ring-lavender/25 sm:p-7 lg:col-start-1 lg:row-start-2"
          >
            <svg aria-hidden="true" viewBox="0 0 120 120" className="absolute -right-6 -top-6 size-36 text-lavender/20">
              <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="10" />
              <circle cx="60" cy="60" r="30" fill="none" stroke="currentColor" strokeWidth="10" />
            </svg>
            <h2 id="best-next-step-heading" className="relative text-[13px] font-bold uppercase tracking-[0.08em] text-accent">
              Best next step
            </h2>
            <p className="relative mt-3 font-display text-[22px] font-bold leading-snug text-ink">{view.top.task.title}</p>
            <p className="relative mt-1 text-sm font-medium text-ink-muted">
              <CourseBadge course={courseOf(view.top.task.courseId)} />
            </p>
            <ul className="relative mt-4 flex flex-wrap gap-2 text-[13px] font-semibold text-body">
              {view.top.reasons.map((reason) => (
                <li key={reason} className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-line">
                  {reason}
                </li>
              ))}
            </ul>
            <p className="relative mt-4 text-[13px] font-medium text-ink-muted">
              {[
                view.top.task.estMinutes !== null ? humanDuration(view.top.task.estMinutes * MINUTE_MS) : null,
                view.top.task.importance === 3 ? "High impact" : null,
                progress.total > 0 ? `${progress.done}/${progress.total} done ${progress.scope}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="relative mt-5 flex flex-wrap items-center gap-2">
              <form action={setTaskStatusAction}>
                <input type="hidden" name="id" value={view.top.task.id} />
                <input type="hidden" name="status" value="done" />
                <button type="submit" className={BUTTON_PRIMARY} aria-label={`Mark "${view.top.task.title}" done`}>
                  <Icon name="check" className="size-4" />
                  Mark done
                </button>
              </form>
              <Link href="/tasks" className={BUTTON_GHOST}>
                See all tasks
              </Link>
            </div>
          </section>
        ) : (
          <div className="lg:col-start-1 lg:row-start-2">
            <EmptyState title="Best next step" icon="focus">
              The one task worth doing first today, with the reason, will show here.
            </EmptyState>
          </div>
        )}
      </div>

      <section aria-labelledby="deadlines-soon-heading">
        <SectionHeader id="deadlines-soon-heading" title="Deadlines coming up" action={{ href: "/deadlines", label: "All deadlines" }} />
        {view.overdueCount > 0 && (
          <p className="-mt-2 mb-4">
            <Link
              href="/deadlines"
              className="inline-flex items-center gap-1.5 rounded-full bg-coral-50 px-3 py-1.5 text-sm font-semibold text-coral-ink ring-1 ring-coral/25"
            >
              <Icon name="flag" className="size-4" />
              {view.overdueCount} overdue
            </Link>
          </p>
        )}
        {view.dueNext.length === 0 ? (
          <EmptyState title="Nothing due yet" icon="deadlines">
            Add a course or a deadline and it will show here.
          </EmptyState>
        ) : (
          <div className="relative -mx-5 md:mx-0">
            <ul className="scroll-row -my-4 flex gap-4 overflow-x-auto px-5 py-4 md:my-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:py-0 xl:grid-cols-3">
              {view.dueNext.map((task) => (
                <li key={task.id} className="w-[78%] shrink-0 sm:w-[46%] md:w-auto">
                  <DeadlineCard task={task as typeof task & { dueAt: number }} course={courseOf(task.courseId)} now={now} />
                </li>
              ))}
            </ul>
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent md:hidden" />
          </div>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_1fr]">
        <section aria-labelledby="timeline-heading" className={CARD}>
          <SectionHeader id="timeline-heading" title="Today’s timetable" action={{ href: "/timetable", label: "View full timetable" }} />
          {timeline.length ? (
            <ScheduleTimeline events={timeline} courseById={courseById} label="Today’s classes and deadlines" />
          ) : (
            <p className="rounded-[18px] bg-tint px-4 py-6 text-center text-sm text-ink-muted">
              No classes or deadlines today. Enjoy the space, or get ahead on something.
            </p>
          )}
        </section>

        <section aria-labelledby="study-plan-heading" className={CARD}>
          <SectionHeader id="study-plan-heading" title="Study plan" action={{ href: "/tasks", label: "All tasks" }} />
          {plan.length ? (
            <ul>
              {plan.map((task) => (
                <TaskRow key={task.id} task={task} course={courseOf(task.courseId)} now={now} />
              ))}
            </ul>
          ) : (
            <p className="rounded-[18px] bg-tint px-4 py-6 text-center text-sm text-ink-muted">
              No open tasks. Add one, and the most useful ones will line up here.
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="revisit-heading" className={`${CARD} flex flex-col gap-4 lg:flex-row lg:items-center`}>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-lavender-50 text-lavender">
          <Icon name="lightbulb" className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="revisit-heading" className="text-lg">
            Things to revisit
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Save concepts that need another look before your next review. Concepts you mark as confusing in Prepare Class will collect here.
          </p>
        </div>
        <Link href="/prepare" className={`${BUTTON_GHOST} self-start lg:self-center`}>
          Open Prepare Class
          <Icon name="arrow-right" className="size-4" />
        </Link>
      </section>
    </div>
  );
}

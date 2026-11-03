import Link from "next/link";
import { connection } from "next/server";
import { CourseBadge } from "@/components/course-dot";
import { Icon, type IconName } from "@/components/icons";
import { ReviewForm, type PlanRow } from "@/components/review-form";
import { CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { getReview, listReviews } from "@/db/reviews";
import { listAttempts, listConcepts } from "@/db/study";
import { isOpen, listTasks, type Task } from "@/db/tasks";
import { requestTime } from "@/lib/clock";
import { latestDay, planCandidates, suggestPlan, summarizeWeek, weekLabel, UNESTIMATED_MINUTES } from "@/lib/review";
import { DAY_MS, formatDue, formatMinutes, shanghaiParts, startOfShanghaiWeek, weekdayName } from "@/lib/time";
import { describeLoad, weeklyWorkload } from "@/lib/workload";

function ReviewCard({ id, icon, tint, title, value, note, children }: {
  id: string;
  icon: IconName;
  tint: string;
  title: string;
  value: string;
  note: string;
  children?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={CARD}>
      <div className="flex items-center gap-3">
        <span className={`flex size-10 items-center justify-center rounded-full ${tint}`}>
          <Icon name={icon} />
        </span>
        <h2 id={id} className="text-[17px]">
          {title}
        </h2>
      </div>
      <p className="mt-4 font-display text-[32px] font-bold leading-none text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink-muted">{note}</p>
      {children}
    </section>
  );
}

function TaskList({ tasks, courseOf }: { tasks: Task[]; courseOf: (id: string | null) => { title: string; color: string } | null }) {
  if (!tasks.length) return null;
  return (
    <ul className="mt-4 space-y-2 border-t border-line pt-4">
      {tasks.slice(0, 4).map((t) => (
        <li key={t.id} className="text-sm">
          <span className={`font-semibold ${isOpen(t) ? "text-ink" : "text-ink-muted line-through"}`}>{t.title}</span>
          <span className="ml-2 inline-flex text-[13px] text-ink-muted">
            <CourseBadge course={courseOf(t.courseId)} />
          </span>
        </li>
      ))}
      {tasks.length > 4 && <li className="text-[13px] text-ink-muted">and {tasks.length - 4} more</li>}
    </ul>
  );
}

// The week in review: what happened, a short reflection, and a next-week plan that respects every deadline.
export async function ReviewData({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  await connection();
  const db = getDb();
  const now = requestTime();
  const current = startOfShanghaiWeek(now);
  const asked = Number(params.week);
  const weekStart = Number.isFinite(asked) && startOfShanghaiWeek(asked) === asked && asked <= current ? asked : current;
  const weekEnd = weekStart + 7 * DAY_MS;

  const courseById = new Map(listCourses(db).map((c) => [c.id, c]));
  const courseOf = (id: string | null) => (id ? (courseById.get(id) ?? null) : null);
  const tasks = listTasks(db, { includeDone: true });
  const summary = summarizeWeek(tasks, weekStart, now);
  const dueThisWeek = tasks.filter((t) => t.dueAt !== null && t.dueAt >= weekStart && t.dueAt < weekEnd);
  const doneThisWeek = dueThisWeek.filter((t) => !isOpen(t)).length;
  const [thisWeekLoad, nextWeekLoad] = weekStart === current ? weeklyWorkload(tasks, now, 2) : [undefined, undefined];
  const slipped = [...summary.postponed, ...summary.overdue.filter((t) => t.status !== "postponed")];
  const answered = listAttempts(db, { since: weekStart }).filter((a) => a.createdAt < weekEnd).length;
  const confusing = listConcepts(db, { status: "confusing" });
  const saved = getReview(db, weekStart);
  const past = listReviews(db).filter((r) => r.weekStart !== weekStart);

  // Next week's plan: the saved one if there is one, otherwise the suggestion; other candidates stay unticked.
  const open = tasks.filter((t) => isOpen(t));
  const suggestion = suggestPlan(open, weekEnd);
  const dayLabels = Array.from({ length: 7 }, (_, d) => `${weekdayName(d + 1)} ${shanghaiParts(weekEnd + d * DAY_MS).day}`);
  const describe = (t: Task) =>
    [courseOf(t.courseId)?.title, t.dueAt !== null ? `due ${formatDue(t.dueAt, now)}` : "no deadline", formatMinutes(t.estMinutes ?? UNESTIMATED_MINUTES) + (t.estMinutes ? "" : " (guess)")]
      .filter(Boolean)
      .join(" · ");
  const byId = new Map(open.map((t) => [t.id, t]));
  const rows: PlanRow[] = [];
  const seen = new Set<string>();
  const push = (taskId: string, day: number, included: boolean, warning: string | null) => {
    const t = byId.get(taskId);
    if (!t || seen.has(taskId)) return;
    seen.add(taskId);
    const maxDay = latestDay(t, weekEnd);
    rows.push({ taskId, title: t.title, detail: describe(t), maxDay, day: Math.min(day, maxDay), included, warning });
  };
  if (saved) for (const item of saved.plan) push(item.taskId, item.day, true, null);
  for (const item of suggestion) push(item.taskId, item.day, !saved, item.overCapacity ? "That day is already full: consider starting earlier." : null);
  for (const t of planCandidates(open, weekEnd)) push(t.id, 0, false, null);

  return (
    <div className="space-y-6">
      <p className="text-sm font-semibold text-ink-muted">
        Week of {weekLabel(weekStart)}
        {weekStart !== current && (
          <>
            {" · "}
            <Link href="/review" className="text-accent underline decoration-lilac underline-offset-4">
              back to this week
            </Link>
          </>
        )}
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <ReviewCard
          id="review-deadlines"
          icon="deadlines"
          tint="bg-lavender-50 text-lavender"
          title="This week’s deadlines"
          value={`${doneThisWeek} of ${dueThisWeek.length}`}
          note={dueThisWeek.length ? "done so far" : "Nothing was due this week."}
        >
          <TaskList tasks={dueThisWeek} courseOf={courseOf} />
        </ReviewCard>
        <ReviewCard
          id="review-done"
          icon="tasks"
          tint="bg-mint-50 text-mint-ink"
          title="Finished"
          value={String(summary.done.length)}
          note={`tasks marked done this week${thisWeekLoad?.minutes ? `; ${formatMinutes(thisWeekLoad.minutes)} of open work left` : ""}`}
        >
          <TaskList tasks={summary.done} courseOf={courseOf} />
        </ReviewCard>
        <ReviewCard
          id="review-slipped"
          icon="flag"
          tint="bg-coral-50 text-coral-ink"
          title="Postponed or overdue"
          value={String(slipped.length)}
          note={slipped.length ? "worth a look before planning" : "Nothing slipped. Well done."}
        >
          <TaskList tasks={slipped} courseOf={courseOf} />
        </ReviewCard>
        <ReviewCard
          id="review-learning"
          icon="lightbulb"
          tint="bg-sky-50 text-periwinkle"
          title="Learning"
          value={String(answered)}
          note={`practice answer${answered === 1 ? "" : "s"} this week · ${confusing.length} concept${confusing.length === 1 ? "" : "s"} still confusing`}
        >
          {confusing.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              {confusing.slice(0, 6).map((c) => (
                <li key={c.id} className="rounded-full bg-coral-50 px-3 py-1 text-[13px] font-semibold text-coral-ink">
                  {c.term}
                </li>
              ))}
            </ul>
          )}
        </ReviewCard>
      </div>

      <section aria-labelledby="reflect-heading" className={CARD}>
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-blush text-pink">
            <Icon name="sparkle" />
          </span>
          <div>
            <h2 id="reflect-heading" className="text-[17px]">
              Reflect and plan
            </h2>
            <p className="text-[13px] text-ink-muted">
              {saved
                ? `Saved ${formatDue(saved.updatedAt, now)}. Change anything and save again.`
                : nextWeekLoad?.tasks
                  ? `Next week: ${describeLoad(nextWeekLoad).toLowerCase()}.`
                  : "A few honest lines, then a realistic plan."}
            </p>
          </div>
        </div>
        <ReviewForm
          weekStart={weekStart}
          dayLabels={dayLabels}
          rows={rows}
          defaults={{ wentWell: saved?.wentWell ?? "", wasHard: saved?.wasHard ?? "", reflection: saved?.reflection ?? "" }}
        />
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-heading" className={CARD}>
          <h2 id="past-heading" className="text-lg">
            Earlier reviews
          </h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {past.map((r) => (
              <li key={r.weekStart} className="py-2.5">
                <Link href={`/review?week=${r.weekStart}`} className="font-semibold text-ink hover:text-accent">
                  Week of {weekLabel(r.weekStart)}
                </Link>
                <span className="text-ink-muted"> · {r.plan.length} planned</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

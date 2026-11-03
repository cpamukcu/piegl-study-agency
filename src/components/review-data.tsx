import Link from "next/link";
import { connection } from "next/server";
import { CourseDot } from "@/components/course-dot";
import { ReviewForm, type PlanRow } from "@/components/review-form";
import { CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { getReview, listReviews } from "@/db/reviews";
import { listAttempts, listConcepts } from "@/db/study";
import { listTasks, type Task } from "@/db/tasks";
import { requestTime } from "@/lib/clock";
import { latestDay, planCandidates, suggestPlan, summarizeWeek, weekLabel, UNESTIMATED_MINUTES } from "@/lib/review";
import { DAY_MS, formatDue, formatMinutes, shanghaiParts, startOfShanghaiWeek, weekdayName } from "@/lib/time";

function TaskList({ tasks, empty, now, courseOf }: { tasks: Task[]; empty: string; now: number; courseOf: (id: string | null) => { title: string; color: string } | null }) {
  if (tasks.length === 0) return <p className="mt-1 text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="mt-1 space-y-1 text-sm">
      {tasks.map((t) => {
        const c = courseOf(t.courseId);
        return (
          <li key={t.id} className="flex flex-wrap items-center gap-x-2">
            {c && <CourseDot color={c.color} />}
            <span>{t.title}</span>
            {t.dueAt !== null && <span className="text-ink-muted">· due {formatDue(t.dueAt, now)}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export async function ReviewData({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  await connection();
  const db = getDb();
  const now = requestTime();
  const current = startOfShanghaiWeek(now);
  const asked = Number(params.week);
  const weekStart = Number.isFinite(asked) && startOfShanghaiWeek(asked) === asked && asked <= current ? asked : current;
  const nextWeek = weekStart + 7 * DAY_MS;

  const courses = new Map(listCourses(db).map((c) => [c.id, c]));
  const courseOf = (id: string | null) => (id ? (courses.get(id) ?? null) : null);
  const all = listTasks(db, { includeDone: true });
  const summary = summarizeWeek(all, weekStart, now);
  const answered = listAttempts(db, { since: weekStart }).filter((a) => a.createdAt < nextWeek).length;
  const confusing = listConcepts(db, { status: "confusing" });
  const saved = getReview(db, weekStart);
  const past = listReviews(db).filter((r) => r.weekStart !== weekStart);

  const open = all.filter((t) => t.status !== "done");
  const suggestion = suggestPlan(open, nextWeek);
  const dayLabels = Array.from({ length: 7 }, (_, d) => `${weekdayName(d + 1)} ${shanghaiParts(nextWeek + d * DAY_MS).day}`);
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
    const maxDay = latestDay(t, nextWeek);
    rows.push({ taskId, title: t.title, detail: describe(t), maxDay, day: Math.min(day, maxDay), included, warning });
  };
  if (saved) for (const item of saved.plan) push(item.taskId, item.day, true, null);
  for (const item of suggestion) push(item.taskId, item.day, !saved, item.overCapacity ? "That day is already full: consider starting earlier or asking for help." : null);
  for (const t of planCandidates(open, nextWeek)) push(t.id, 0, false, null);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">
        Reviewing the week of {weekLabel(weekStart)}
        {weekStart !== current && (
          <>
            {" · "}
            <Link href="/review" className="underline underline-offset-2">
              back to this week
            </Link>
          </>
        )}
      </p>
      <section aria-labelledby="week-heading" className={CARD}>
        <h2 id="week-heading" className="font-serif text-lg">
          The week in numbers
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          {[
            ["finished", summary.done.length],
            ["postponed", summary.postponed.length],
            ["still overdue", summary.overdue.length],
            ["practice answers", answered],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-paper py-3">
              <dd className="text-2xl font-semibold">{value}</dd>
              <dt className="text-xs text-ink-muted">{label}</dt>
            </div>
          ))}
        </dl>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">Finished</h3>
            <TaskList tasks={summary.done} empty="Nothing marked done this week." now={now} courseOf={courseOf} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Postponed or overdue</h3>
            <TaskList tasks={[...summary.postponed, ...summary.overdue.filter((t) => t.status !== "postponed")]} empty="Nothing slipped." now={now} courseOf={courseOf} />
          </div>
          <div className="sm:col-span-2">
            <h3 className="text-sm font-semibold">Still confusing</h3>
            {confusing.length === 0 ? (
              <p className="mt-1 text-sm text-ink-muted">No concepts marked confusing.</p>
            ) : (
              <p className="mt-1 text-sm">{confusing.map((c) => c.term).join(" · ")}</p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="reflect-heading" className={CARD}>
        <h2 id="reflect-heading" className="sr-only">
          Reflection and plan
        </h2>
        {saved && <p className="mb-4 text-sm text-ink-muted">Saved {formatDue(saved.updatedAt, now)}. You can change it and save again.</p>}
        <ReviewForm
          weekStart={weekStart}
          dayLabels={dayLabels}
          rows={rows}
          defaults={{ wentWell: saved?.wentWell ?? "", wasHard: saved?.wasHard ?? "", reflection: saved?.reflection ?? "" }}
        />
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-heading" className={CARD}>
          <h2 id="past-heading" className="font-serif text-lg">
            Earlier reviews
          </h2>
          <ul className="mt-2 text-sm">
            {past.map((r) => (
              <li key={r.weekStart} className="border-b border-line py-2 last:border-b-0">
                <Link href={`/review?week=${r.weekStart}`} className="underline-offset-2 hover:underline">
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

import { connection } from "next/server";
import { CourseBadge } from "@/components/course-dot";
import { EmptyState } from "@/components/empty-state";
import { Icon, type IconName } from "@/components/icons";
import { CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { isOpen, listTasks, type Task } from "@/db/tasks";
import { requestTime } from "@/lib/clock";
import { groupTasks } from "@/lib/deadline-groups";
import { DAY_MS, formatDate, formatMinutes, startOfShanghaiWeek } from "@/lib/time";
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
    </ul>
  );
}

// A calm summary of this week and the next, from the tasks you already have.
export async function ReviewData() {
  await connection();
  const db = getDb();
  const now = requestTime();
  const courseById = new Map(listCourses(db).map((c) => [c.id, c]));
  const courseOf = (id: string | null) => (id ? (courseById.get(id) ?? null) : null);
  const tasks = listTasks(db, { includeDone: true });
  const weekStart = startOfShanghaiWeek(now);
  const weekEnd = weekStart + 7 * DAY_MS;
  const dueThisWeek = tasks.filter((t) => t.dueAt !== null && t.dueAt >= weekStart && t.dueAt < weekEnd);
  const doneThisWeek = dueThisWeek.filter((t) => !isOpen(t)).length;
  const [thisWeek, nextWeek] = weeklyWorkload(tasks, now, 2);
  const done = groupTasks(tasks, now).doneRecently;
  const nextWeekTasks = tasks
    .filter((t) => isOpen(t) && t.dueAt !== null && t.dueAt >= weekEnd && t.dueAt < weekEnd + 7 * DAY_MS)
    .sort((a, b) => (a.dueAt as number) - (b.dueAt as number));

  return (
    <div className="space-y-6">
      <p className="text-sm font-semibold text-ink-muted">
        Week of {formatDate(weekStart)} – {formatDate(weekEnd - DAY_MS)}
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
          id="review-time"
          icon="clock"
          tint="bg-sky-50 text-periwinkle"
          title="Time planned"
          value={thisWeek && thisWeek.minutes ? formatMinutes(thisWeek.minutes) : "—"}
          note={thisWeek ? `Open work left this week: ${describeLoad(thisWeek).toLowerCase()}` : "No tasks"}
        />
        <ReviewCard
          id="review-done"
          icon="tasks"
          tint="bg-mint-50 text-mint-ink"
          title="Completed tasks"
          value={String(done.length)}
          note="finished in the last 7 days"
        >
          <TaskList tasks={done} courseOf={courseOf} />
        </ReviewCard>
        <ReviewCard
          id="review-next"
          icon="sparkle"
          tint="bg-blush text-pink"
          title="Focus for next week"
          value={nextWeek && nextWeek.tasks ? (nextWeek.minutes ? formatMinutes(nextWeek.minutes) : `${nextWeek.tasks} ${nextWeek.tasks === 1 ? "task" : "tasks"}`) : "—"}
          note={nextWeek && nextWeek.tasks ? describeLoad(nextWeek) : "Nothing due next week yet."}
        >
          <TaskList tasks={nextWeekTasks} courseOf={courseOf} />
        </ReviewCard>
      </div>
      <EmptyState title="Reflection notes" art="chart">
        A guided look back at what you planned, finished, postponed, and found confusing will show here.
      </EmptyState>
    </div>
  );
}

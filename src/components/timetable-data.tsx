import Link from "next/link";
import { connection } from "next/server";
import { CourseDot } from "@/components/course-dot";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icons";
import { ScheduleTimeline } from "@/components/schedule-timeline";
import { CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { listMeetingTimes } from "@/db/meetings";
import { materializePrepTasks } from "@/db/rules";
import { listTasks } from "@/db/tasks";
import { listTerms } from "@/db/terms";
import { requestTime } from "@/lib/clock";
import { clockOf, dateKey, dayTimeline, formatLongDate } from "@/lib/day-plan";
import { sessionsBetween, teachingWeek, weekOneMonday } from "@/lib/sessions";
import { DAY_MS, shanghaiParts, shanghaiToMs, startOfShanghaiDay, startOfShanghaiWeek, weekdayName } from "@/lib/time";

type Search = { day?: string | string[] };

// The day to show: ?day=YYYY-MM-DD, or today when missing or not a real date.
export function pickDay(value: string | string[] | undefined, now: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    try {
      return shanghaiToMs(raw);
    } catch {
      // Fall through to today.
    }
  }
  return startOfShanghaiDay(now);
}

const PILL_LINK = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export async function TimetableData({ searchParams }: { searchParams?: Promise<Search> } = {}) {
  const search = (await searchParams) ?? {};
  await connection();
  const db = getDb();
  const now = requestTime();
  materializePrepTasks(db, now);

  const today = startOfShanghaiDay(now);
  const day = pickDay(search.day, now);
  const weekStart = startOfShanghaiWeek(day);
  const courseById = new Map(listCourses(db).map((c) => [c.id, c]));
  const terms = listTerms(db);
  const weekSessions = sessionsBetween(listMeetingTimes(db), terms, weekStart, weekStart + 7 * DAY_MS);
  const tasks = listTasks(db, { includeDone: true });
  const events = dayTimeline(day, weekSessions, tasks, now);
  const term = terms.find((t) => day >= weekOneMonday(t) && teachingWeek(t, day) <= t.weeks);
  const days = Array.from({ length: 7 }, (_, i) => weekStart + i * DAY_MS);
  const href = (ms: number) => (ms === today ? "/timetable" : `/timetable?day=${dateKey(ms)}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-muted">
          {term ? `Teaching week ${teachingWeek(term, day)} · ` : ""}
          Week of {formatLongDate(weekStart).replace(/^\w+, /, "")}
        </p>
        <div className="flex items-center gap-2">
          <Link href={href(weekStart - 7 * DAY_MS)} aria-label="Previous week" title="Previous week" className={`inline-flex size-9 items-center justify-center rounded-full bg-surface text-ink-muted shadow-card ring-1 ring-line hover:text-accent ${PILL_LINK}`}>
            <Icon name="chevron-left" className="size-4" />
          </Link>
          {day !== today && (
            <Link href="/timetable" className={`rounded-full bg-lavender-50 px-3.5 py-2 text-sm font-semibold text-accent hover:bg-[#ebe4fd] ${PILL_LINK}`}>
              Today
            </Link>
          )}
          <Link href={href(weekStart + 7 * DAY_MS)} aria-label="Next week" title="Next week" className={`inline-flex size-9 items-center justify-center rounded-full bg-surface text-ink-muted shadow-card ring-1 ring-line hover:text-accent ${PILL_LINK}`}>
            <Icon name="chevron-right" className="size-4" />
          </Link>
        </div>
      </div>

      <nav aria-label="Days of the week" className="rounded-[22px] bg-surface-soft p-1.5 ring-1 ring-line">
        <ul className="grid grid-cols-7 gap-1">
          {days.map((ms) => {
            const selected = ms === day;
            const isToday = ms === today;
            const busy = weekSessions.some((s) => startOfShanghaiDay(s.startsAt) === ms);
            return (
              <li key={ms}>
                <Link
                  href={href(ms)}
                  aria-current={selected ? "date" : undefined}
                  aria-label={`${formatLongDate(ms)}${isToday ? ", today" : ""}`}
                  className={`flex flex-col items-center rounded-[16px] py-2 transition duration-200 ${PILL_LINK} ${
                    selected ? "bg-action text-white shadow-card" : "text-ink hover:bg-white"
                  }`}
                >
                  <span className={`text-[11px] font-bold uppercase tracking-[0.06em] ${selected ? "text-white/90" : "text-ink-muted"}`}>
                    {weekdayName(shanghaiParts(ms).weekday)}
                  </span>
                  <span className="font-display text-lg font-bold leading-tight">{shanghaiParts(ms).day}</span>
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 size-1.5 rounded-full ${isToday ? (selected ? "bg-white" : "bg-pink") : busy ? (selected ? "bg-white/60" : "bg-lilac") : "bg-transparent"}`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="day-heading" className={CARD}>
          <h2 id="day-heading" className="mb-4 text-lg sm:text-xl">
            {day === today ? "Today" : formatLongDate(day)}
          </h2>
          {events.length ? (
            <ScheduleTimeline events={events} courseById={courseById} label={`Classes and deadlines, ${formatLongDate(day)}`} />
          ) : (
            <p className="rounded-[18px] bg-tint px-4 py-8 text-center text-sm text-ink-muted">No classes or deadlines on this day.</p>
          )}
        </section>

        <section aria-labelledby="week-heading" className={CARD}>
          <h2 id="week-heading" className="mb-3 text-lg sm:text-xl">
            Week at a glance
          </h2>
          {weekSessions.length === 0 ? (
            <p className="text-sm leading-relaxed text-ink-muted">
              No classes this week. Add class times to a course, or import your ZJU timetable in Settings.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {days.map((ms) => {
                const list = weekSessions.filter((s) => startOfShanghaiDay(s.startsAt) === ms);
                return (
                  <li key={ms} className="flex gap-4 py-3">
                    <span className={`w-10 shrink-0 pt-0.5 text-[13px] font-bold ${ms === today ? "text-accent" : "text-ink-muted"}`}>
                      {weekdayName(shanghaiParts(ms).weekday)}
                    </span>
                    {list.length ? (
                      <ul className="min-w-0 flex-1 space-y-1.5">
                        {list.map((s) => {
                          const course = courseById.get(s.courseId);
                          return (
                            <li key={`${s.meetingTimeId}-${s.startsAt}`} className="flex items-center gap-2 text-sm">
                              {course && <CourseDot color={course.color} />}
                              <span className="truncate font-semibold text-ink">{course?.title ?? "Class"}</span>
                              <span className="ml-auto shrink-0 tabular-nums text-ink-muted">
                                {clockOf(s.startsAt)}–{clockOf(s.endsAt)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <span className="text-sm text-faint">Free</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {weekSessions.length === 0 && events.length === 0 && (
        <EmptyState title="Your timetable is empty" art="calendar">
          Class times you add to a course, or import from ZJU, show up here day by day.
        </EmptyState>
      )}
    </div>
  );
}

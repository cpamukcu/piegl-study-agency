import Link from "next/link";
import { connection } from "next/server";
import { setTaskStatusAction } from "@/app/actions";
import { CourseDot } from "@/components/course-dot";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icons";
import { StatusPill } from "@/components/priority-pill";
import { BUTTON_GHOST, BUTTON_PRIMARY, CARD, CARD_LG } from "@/components/ui";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { listMeetingTimes } from "@/db/meetings";
import { listRules, materializePrepTasks } from "@/db/rules";
import { listTasks, type Task } from "@/db/tasks";
import { listTerms } from "@/db/terms";
import { requestTime } from "@/lib/clock";
import { clockOf, timeUntil } from "@/lib/day-plan";
import { sessionsBetween, type ClassSession } from "@/lib/sessions";
import { DAY_MS, formatDue } from "@/lib/time";

function prepFor(tasks: Task[], s: ClassSession): Task | null {
  return tasks.find((t) => t.type === "prep" && t.courseId === s.courseId && t.occurrenceKey === String(s.startsAt)) ?? null;
}

function CheckItem({ done, title, children }: { done: boolean; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-b border-line py-4 last:border-b-0">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${done ? "bg-action text-white" : "border-2 border-line-strong text-transparent"}`}
      >
        <Icon name="check" strokeWidth={2.6} className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] font-semibold ${done ? "text-ink-muted" : "text-ink"}`}>
          {title}
          <span className="sr-only">{done ? " (done)" : " (to do)"}</span>
        </p>
        {children}
      </div>
    </li>
  );
}

function ResourceItem({ icon, title, children }: { icon: "link" | "edit"; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-b border-line py-4 last:border-b-0">
      <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-lavender-50 text-lavender">
        <Icon name={icon} className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {children}
      </div>
    </li>
  );
}

// The class preparation checklist: the next class first, built from the course's
// prep task, links and notes. Class materials arrive with milestone M2.
export async function PrepareData() {
  await connection();
  const db = getDb();
  const now = requestTime();
  materializePrepTasks(db, now);

  const courseById = new Map(listCourses(db).map((c) => [c.id, c]));
  const sessions = sessionsBetween(listMeetingTimes(db), listTerms(db), now, now + 7 * DAY_MS).filter((s) => courseById.has(s.courseId));
  const tasks = listTasks(db, { includeDone: true });
  const next = sessions[0];

  if (!next) {
    return (
      <EmptyState title="No classes coming up" art="calendar" action={<Link href="/courses" className={BUTTON_GHOST}>Add class times to a course</Link>}>
        Your next class and its preparation checklist will show here.
      </EmptyState>
    );
  }

  const course = courseById.get(next.courseId)!;
  const prep = prepFor(tasks, next);
  const hasRoutine = listRules(db, course.id).some((r) => r.active);
  const soon = timeUntil(next.startsAt, now);
  const later = sessions.slice(1, 6);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section aria-labelledby="next-class-heading" className={`${CARD_LG} relative overflow-hidden`}>
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-52 w-72 rounded-full bg-wash blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-muted">Next class</p>
          {soon && <StatusPill tone="lavender">{soon}</StatusPill>}
        </div>
        <div className="relative mt-4 flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `color-mix(in srgb, ${course.color} 14%, white)`, color: course.color }}
          >
            <Icon name="book" className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 id="next-class-heading" className="text-2xl">
              {course.title}
            </h2>
            <p className="mt-1 text-sm font-medium text-body">
              {formatDue(next.startsAt, now)}–{clockOf(next.endsAt)}
              {next.room ? ` · ${next.room}` : ""}
            </p>
          </div>
        </div>

        <h3 className="relative mt-7 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-muted">Before class</h3>
        <ul className="relative mt-1">
          <CheckItem done={prep?.status === "done"} title={prep ? prep.title : "Prep task"}>
            {prep ? (
              prep.status === "done" ? (
                <p className="mt-1 text-[13px] text-ink-muted">Ready. Nice work.</p>
              ) : (
                <>
                  <p className="mt-1 text-[13px] text-ink-muted">Due {formatDue(prep.dueAt as number, now)}</p>
                  <form action={setTaskStatusAction} className="mt-3">
                    <input type="hidden" name="id" value={prep.id} />
                    <input type="hidden" name="status" value="done" />
                    <button type="submit" className={BUTTON_PRIMARY}>
                      <Icon name="check" className="size-4" />
                      Mark ready
                    </button>
                  </form>
                </>
              )
            ) : (
              <p className="mt-1 text-[13px] text-ink-muted">
                {hasRoutine ? (
                  "Your prep routine will add a task before this class."
                ) : (
                  <Link href={`/courses/${course.id}`} className="font-semibold text-accent underline decoration-lilac underline-offset-4">
                    Add a prep routine
                  </Link>
                )}
              </p>
            )}
          </CheckItem>
        </ul>

        <h3 className="relative mt-6 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-muted">Resources</h3>
        <ul className="relative mt-1">
          <ResourceItem icon="link" title="Course links">
            {course.links.length ? (
              <ul className="mt-1.5 space-y-1">
                {course.links.map((link) => (
                  <li key={link} className="flex items-center gap-2 text-[13px]">
                    <Icon name="link" className="size-3.5 text-faint" />
                    <a href={link} target="_blank" rel="noreferrer" className="break-all font-medium text-accent underline decoration-lilac underline-offset-4">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[13px] text-ink-muted">
                No links saved.{" "}
                <Link href={`/courses/${course.id}#edit-course`} className="font-semibold text-accent underline decoration-lilac underline-offset-4">
                  Add links
                </Link>
              </p>
            )}
          </ResourceItem>
          <ResourceItem icon="edit" title="Your notes">
            <p className="mt-1 max-w-prose text-[13px] text-body">{course.notes ?? "No notes for this course yet."}</p>
          </ResourceItem>
        </ul>
      </section>

      <div className="space-y-6">
        <EmptyState title="No class materials yet" art="books">
          Slides and readings for your next classes will show here, ready to study.
        </EmptyState>
        {later.length > 0 && (
          <section aria-labelledby="later-classes-heading" className={CARD}>
            <h2 id="later-classes-heading" className="text-lg">
              Later this week
            </h2>
            <ul className="mt-2 divide-y divide-line">
              {later.map((s) => {
                const c = courseById.get(s.courseId)!;
                const p = prepFor(tasks, s);
                return (
                  <li key={`${s.meetingTimeId}-${s.startsAt}`} className="flex items-center gap-3 py-3">
                    <CourseDot color={c.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{c.title}</span>
                      <span className="block text-[13px] text-ink-muted">{formatDue(s.startsAt, now)}</span>
                    </span>
                    {p && <StatusPill tone={p.status === "done" ? "mint" : "lavender"}>{p.status === "done" ? "Ready" : "Prep"}</StatusPill>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

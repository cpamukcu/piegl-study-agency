import { notFound } from "next/navigation";
import { connection } from "next/server";
import { deleteCourseAction, deleteMeetingAction, deleteRuleAction } from "@/app/actions";
import { Icon } from "@/components/icons";
import { CourseForm } from "@/components/course-form";
import { MeetingForm } from "@/components/meeting-form";
import { RuleForm } from "@/components/rule-form";
import { TaskRow } from "@/components/task-row";
import { BUTTON_DANGER, BUTTON_SECONDARY, CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { getCourse } from "@/db/courses";
import { listMeetingTimes } from "@/db/meetings";
import { listRules, materializePrepTasks, type RecurrenceRule } from "@/db/rules";
import { listTasks } from "@/db/tasks";
import { requestTime } from "@/lib/clock";
import { describeMeeting } from "@/lib/sessions";
import { MINUTE_MS, humanDuration } from "@/lib/time";

function describeRule(rule: RecurrenceRule): string {
  const when = rule.leadMinutes === 0 ? "due when class starts" : `due ${humanDuration(rule.leadMinutes * MINUTE_MS)} before each class`;
  const parts = [rule.title, when];
  if (rule.estMinutes !== null) parts.push(`about ${humanDuration(rule.estMinutes * MINUTE_MS)}`);
  return parts.join(" · ");
}

export async function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const db = getDb();
  const course = getCourse(db, id);
  if (!course) notFound();

  const now = requestTime();
  materializePrepTasks(db, now);
  const meetings = listMeetingTimes(db, id);
  const rules = listRules(db, id);
  const tasks = listTasks(db, { courseId: id });

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[28px] bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-8">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: course.color }} />
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-48 w-64 rounded-full bg-wash blur-2xl" />
        <div className="relative flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `color-mix(in srgb, ${course.color} 14%, white)`, color: course.color }}
          >
            <Icon name="book" className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[28px] leading-tight tracking-tight sm:text-[34px]">{course.title}</h1>
            <p className="mt-2 text-[15px] text-ink-muted">{[course.code, course.instructor, course.semester].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        {course.links.length > 0 && (
          <ul className="relative mt-4 space-y-1.5 text-sm">
            {course.links.map((link) => (
              <li key={link} className="flex items-center gap-2">
                <Icon name="link" className="size-4 text-faint" />
                <a href={link} target="_blank" rel="noreferrer" className="break-all font-medium text-accent underline decoration-lilac underline-offset-4">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        )}
        {course.notes && <p className="relative mt-4 max-w-prose rounded-[16px] bg-surface-soft p-4 text-sm text-body">{course.notes}</p>}
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
      <section aria-labelledby="meetings-heading" className={CARD}>
        <h2 id="meetings-heading" className="text-lg">
          Class times
        </h2>
        {meetings.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No class times yet.</p>
        ) : (
          <ul className="mt-2">
            {meetings.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 border-b border-line py-3 text-sm font-medium text-ink last:border-b-0">
                <span>{describeMeeting(m)}</span>
                <form action={deleteMeetingAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" className={BUTTON_SECONDARY} aria-label={`Remove class time ${describeMeeting(m)}`}>
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <MeetingForm courseId={course.id} />
      </section>

      <section aria-labelledby="rules-heading" className={CARD}>
        <h2 id="rules-heading" className="text-lg">
          Prep routine
        </h2>
        <p className="mt-2 text-sm text-ink-muted">Creates a prep task before each class, for the next two weeks.</p>
        {rules.length > 0 && (
          <ul className="mt-2">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 border-b border-line py-3 text-sm font-medium text-ink last:border-b-0">
                <span>{describeRule(rule)}</span>
                <form action={deleteRuleAction}>
                  <input type="hidden" name="id" value={rule.id} />
                  <button type="submit" className={BUTTON_SECONDARY} aria-label={`Remove prep routine ${rule.title}`}>
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <RuleForm courseId={course.id} />
      </section>
      </div>

      <section aria-labelledby="course-tasks-heading" className={CARD}>
        <h2 id="course-tasks-heading" className="text-lg">
          Open tasks
        </h2>
        {tasks.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No open tasks.</p>
        ) : (
          <ul className="mt-2">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} course={course} now={now} />
            ))}
          </ul>
        )}
      </section>

      <CourseForm course={course} />

      <section aria-labelledby="delete-course-heading" className="rounded-[24px] bg-surface p-5 ring-1 ring-coral/25 sm:p-6">
        <h2 id="delete-course-heading" className="text-lg">
          Delete course
        </h2>
        <p className="mt-2 text-sm text-ink-muted">Deletes the course and its class times. Its tasks stay, without a course.</p>
        <form action={deleteCourseAction} className="mt-3">
          <input type="hidden" name="id" value={course.id} />
          <button type="submit" className={BUTTON_DANGER}>
            Delete course
          </button>
        </form>
      </section>
    </div>
  );
}

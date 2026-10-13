import { notFound } from "next/navigation";
import { connection } from "next/server";
import { deleteCourseAction, deleteMeetingAction, deleteRuleAction } from "@/app/actions";
import { CourseDot } from "@/components/course-dot";
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
      <header>
        <h1 className="flex items-center gap-3 font-serif text-3xl tracking-tight">
          <CourseDot color={course.color} size="lg" />
          {course.title}
        </h1>
        <p className="mt-2 text-ink-muted">{[course.code, course.instructor, course.semester].filter(Boolean).join(" · ")}</p>
        {course.links.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {course.links.map((link) => (
              <li key={link}>
                <a href={link} target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        )}
        {course.notes && <p className="mt-2 max-w-prose text-sm">{course.notes}</p>}
      </header>

      <section aria-labelledby="meetings-heading" className={CARD}>
        <h2 id="meetings-heading" className="font-serif text-lg">
          Class times
        </h2>
        {meetings.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No class times yet.</p>
        ) : (
          <ul className="mt-2">
            {meetings.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
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
        <h2 id="rules-heading" className="font-serif text-lg">
          Prep routine
        </h2>
        <p className="mt-2 text-sm text-ink-muted">Creates a prep task before each class, for the next two weeks.</p>
        {rules.length > 0 && (
          <ul className="mt-2">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
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

      <section aria-labelledby="course-tasks-heading" className={CARD}>
        <h2 id="course-tasks-heading" className="font-serif text-lg">
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

      <section aria-labelledby="delete-course-heading" className={CARD}>
        <h2 id="delete-course-heading" className="font-serif text-lg">
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

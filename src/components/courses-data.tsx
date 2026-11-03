import Link from "next/link";
import { connection } from "next/server";
import { CourseForm } from "@/components/course-form";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icons";
import { getDb } from "@/db/connection";
import { COURSE_COLORS, listCourses } from "@/db/courses";
import { listMeetingTimes } from "@/db/meetings";
import { listTasks } from "@/db/tasks";
import { describeMeeting } from "@/lib/sessions";

export async function CoursesData() {
  await connection();
  const db = getDb();
  const courses = listCourses(db);
  const meetings = listMeetingTimes(db);
  const openTasks = listTasks(db);

  return (
    <div className="space-y-8">
      {courses.length === 0 ? (
        <EmptyState title="No courses yet" art="books">
          Add a course below, or import your ZJU snapshots in Settings.
        </EmptyState>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const open = openTasks.filter((t) => t.courseId === course.id).length;
            return (
              <li key={course.id}>
                <Link
                  href={`/courses/${course.id}`}
                  className="lift relative block h-full overflow-hidden rounded-[24px] bg-surface p-5 shadow-card ring-1 ring-line/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-6"
                >
                  <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: course.color }} />
                  <span className="flex items-start justify-between gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: `color-mix(in srgb, ${course.color} 14%, white)`, color: course.color }}
                    >
                      <Icon name="book" />
                    </span>
                    <span className="rounded-full bg-lavender-50 px-2.5 py-1 text-xs font-semibold text-accent">
                      {open} open {open === 1 ? "task" : "tasks"}
                    </span>
                  </span>
                  <span className="mt-4 block font-display text-lg font-bold text-ink">{course.title}</span>
                  <span className="mt-1 block text-sm text-ink-muted">
                    {[course.code, course.instructor].filter(Boolean).join(" · ") || "No details yet"}
                  </span>
                  {meetings.some((m) => m.courseId === course.id) && (
                    <span className="mt-4 block space-y-1.5 border-t border-line pt-4">
                      {meetings
                        .filter((m) => m.courseId === course.id)
                        .map((m) => (
                          <span key={m.id} className="flex items-start gap-2 text-sm font-medium text-body">
                            <Icon name="clock" className="mt-0.5 size-4 text-faint" />
                            <span>{describeMeeting(m)}</span>
                          </span>
                        ))}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <CourseForm defaultColor={COURSE_COLORS[courses.length % COURSE_COLORS.length]} />
    </div>
  );
}

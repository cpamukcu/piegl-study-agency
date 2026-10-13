import Link from "next/link";
import { connection } from "next/server";
import { CourseDot } from "@/components/course-dot";
import { CourseForm } from "@/components/course-form";
import { EmptyState } from "@/components/empty-state";
import { CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { COURSE_COLORS, listCourses } from "@/db/courses";
import { listMeetingTimes } from "@/db/meetings";
import { describeMeeting } from "@/lib/sessions";

export async function CoursesData() {
  await connection();
  const db = getDb();
  const courses = listCourses(db);
  const meetings = listMeetingTimes(db);

  return (
    <div className="space-y-6">
      {courses.length === 0 ? (
        <EmptyState title="No courses yet" art="books">Add a course below, or import your ZJU snapshots in Settings.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <li key={course.id}>
              <Link
                href={`/courses/${course.id}`}
                className={`block h-full ${CARD} hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
              >
                <span className="flex items-center gap-2 font-serif text-lg">
                  <CourseDot color={course.color} />
                  {course.title}
                </span>
                <span className="mt-1 block text-sm text-ink-muted">
                  {[course.code, course.instructor].filter(Boolean).join(" · ") || "No details yet"}
                </span>
                {meetings
                  .filter((m) => m.courseId === course.id)
                  .map((m) => (
                    <span key={m.id} className="mt-1 block text-sm">
                      {describeMeeting(m)}
                    </span>
                  ))}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CourseForm defaultColor={COURSE_COLORS[courses.length % COURSE_COLORS.length]} />
    </div>
  );
}

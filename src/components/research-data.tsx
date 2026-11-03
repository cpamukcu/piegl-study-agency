import Link from "next/link";
import { connection } from "next/server";
import { CourseDot } from "@/components/course-dot";
import { EmptyState } from "@/components/empty-state";
import { ProjectForm } from "@/components/research-forms";
import { CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { listProjects, listSources } from "@/db/research";
import { requestTime } from "@/lib/clock";
import { formatDue } from "@/lib/time";

export async function ResearchData() {
  await connection();
  const db = getDb();
  const now = requestTime();
  const courses = listCourses(db);
  const byId = new Map(courses.map((c) => [c.id, c]));
  const projects = listProjects(db);

  return (
    <div className="space-y-6">
      {projects.length === 0 ? (
        <EmptyState title="No research questions yet" art="search">
          Start with a question below. You can ask for a suggested plan; sources are only ever added and verified by you.
        </EmptyState>
      ) : (
        <section aria-labelledby="projects-heading" className={CARD}>
          <h2 id="projects-heading" className="text-lg">
            Your questions
          </h2>
          <ul className="mt-2">
            {projects.map((p) => {
              const sources = listSources(db, p.id);
              const course = p.courseId ? byId.get(p.courseId) : null;
              return (
                <li key={p.id} className="border-b border-line py-2 text-sm last:border-b-0">
                  <Link href={`/research/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                    {p.question}
                  </Link>
                  <span className="flex flex-wrap items-center gap-x-3 text-ink-muted">
                    {course && (
                      <span className="inline-flex items-center gap-1.5">
                        <CourseDot color={course.color} />
                        {course.title}
                      </span>
                    )}
                    <span>
                      {sources.length} source{sources.length === 1 ? "" : "s"}, {sources.filter((s) => s.verifiedAt).length} verified
                    </span>
                    <span>updated {formatDue(p.updatedAt, now)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section aria-labelledby="new-project-heading" className={CARD}>
        <h2 id="new-project-heading" className="text-lg">
          New research question
        </h2>
        <ProjectForm courses={courses.map((c) => ({ id: c.id, title: c.title }))} />
      </section>
    </div>
  );
}

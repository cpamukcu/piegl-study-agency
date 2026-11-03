import Link from "next/link";
import { connection } from "next/server";
import { aiStatus } from "@/ai";
import { buildBriefPreview, MAX_MATERIAL_CHARS } from "@/ai/brief";
import { AiOffNote } from "@/components/ai-status-note";
import { CourseDot } from "@/components/course-dot";
import { EmptyState } from "@/components/empty-state";
import { GenerateBriefForm } from "@/components/generate-brief-form";
import { describeMaterial } from "@/components/material-list";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, LABEL } from "@/components/ui";
import { getDb } from "@/db/connection";
import { getCourse, listCourses } from "@/db/courses";
import { listMaterials } from "@/db/materials";
import { listMeetingTimes } from "@/db/meetings";
import { listBriefs } from "@/db/study";
import { listTerms } from "@/db/terms";
import { requestTime } from "@/lib/clock";
import { sessionsBetween } from "@/lib/sessions";
import { DAY_MS, formatDate, formatDue } from "@/lib/time";

type Search = Record<string, string | string[] | undefined>;
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export async function PrepareData({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  await connection();
  const db = getDb();
  const now = requestTime();
  const ai = aiStatus();
  const courses = listCourses(db);
  const byId = new Map(courses.map((c) => [c.id, c]));
  const upcoming = sessionsBetween(listMeetingTimes(db), listTerms(db), now, now + 7 * DAY_MS).slice(0, 8);
  const briefs = listBriefs(db);

  const course = typeof params.course === "string" ? getCourse(db, params.course) : null;
  const at = Number(params.at);
  const classAt = Number.isFinite(at) && at > 0 ? at : null;
  const readable = course ? listMaterials(db, course.id).filter((m) => m.extraction === "ok") : [];
  const chosen = many(params.m).filter((id) => readable.some((m) => m.id === id));
  const preview = course && chosen.length ? buildBriefPreview(db, course, chosen, classAt) : null;

  if (courses.length === 0) {
    return (
      <EmptyState title="No courses yet" art="books">
        Add a course or import your ZJU data first, then upload slides on the course page.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      {!ai.on && <AiOffNote />}

      <section aria-labelledby="upcoming-heading" className={CARD}>
        <h2 id="upcoming-heading" className="font-serif text-lg">
          Next classes
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No classes in the next 7 days. Pick a course below instead.</p>
        ) : (
          <ul className="mt-2">
            {upcoming.map((s) => {
              const c = byId.get(s.courseId);
              if (!c) return null;
              const files = listMaterials(db, c.id).filter((m) => m.extraction === "ok").length;
              return (
                <li key={`${s.meetingTimeId}-${s.startsAt}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
                  <span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <CourseDot color={c.color} />
                      {c.title}
                    </span>
                    <span className="text-ink-muted">
                      {formatDue(s.startsAt, now)}
                      {s.room ? ` · ${s.room}` : ""} · {files} readable file{files === 1 ? "" : "s"}
                    </span>
                  </span>
                  <Link href={`/prepare?course=${c.id}&at=${s.startsAt}`} className={BUTTON_SECONDARY}>
                    Prepare
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <form method="get" action="/prepare" className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="prepare-course" className={LABEL}>
              Or choose a course
            </label>
            <select id="prepare-course" name="course" defaultValue={course?.id ?? ""} className={INPUT}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={BUTTON_SECONDARY}>
            Choose
          </button>
        </form>
      </section>

      {course && (
        <section aria-labelledby="choose-heading" className={CARD}>
          <h2 id="choose-heading" className="font-serif text-lg">
            {course.title}
            {classAt ? `, ${formatDate(classAt)}` : ""}: choose material
          </h2>
          {!course.aiAllowed && <p className="mt-2 text-sm text-warn">AI is turned off for this course, so nothing from it can be sent. Change this on the course page.</p>}
          {readable.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              No readable files yet.{" "}
              <Link href={`/courses/${course.id}`} className="underline underline-offset-2">
                Upload slides or readings
              </Link>{" "}
              on the course page.
            </p>
          ) : (
            <form method="get" action="/prepare" className="mt-3">
              <input type="hidden" name="course" value={course.id} />
              {classAt ? <input type="hidden" name="at" value={classAt} /> : null}
              <fieldset>
                <legend className="sr-only">Files to use</legend>
                <ul className="space-y-2">
                  {readable.map((m) => (
                    <li key={m.id}>
                      <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" name="m" value={m.id} defaultChecked={chosen.includes(m.id)} className="mt-1" />
                        <span>
                          {m.title}
                          <span className="block text-ink-muted">{describeMaterial(m)}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <button type="submit" className={`${BUTTON_PRIMARY} mt-4`}>
                Preview what will be sent
              </button>
            </form>
          )}
        </section>
      )}

      {course && preview && (
        <section aria-labelledby="preview-heading" className={CARD}>
          <h2 id="preview-heading" className="font-serif text-lg">
            What will be sent
          </h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-muted">To</dt>
            <dd>{ai.on ? `${ai.name}, model ${ai.model}` : "Nobody: AI is off"}</dd>
            <dt className="text-ink-muted">Text</dt>
            <dd>
              {preview.pages.length} pages from {chosen.length} file{chosen.length === 1 ? "" : "s"}, {preview.chars.toLocaleString("en")} characters (about{" "}
              {Math.ceil(preview.chars / 4).toLocaleString("en")} tokens)
            </dd>
            <dt className="text-ink-muted">Not sent</dt>
            <dd>Your tasks, notes, other courses, file names on disk, and anything about you.</dd>
          </dl>
          {preview.tooLarge && (
            <p className="mt-2 text-sm text-warn">That is over the {MAX_MATERIAL_CHARS.toLocaleString("en")}-character limit. Choose fewer files.</p>
          )}
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer">Instructions sent with it</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-paper p-3 font-mono text-xs">{preview.system}</pre>
          </details>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer">Full text sent</summary>
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-3 font-mono text-xs">{preview.prompt}</pre>
          </details>
          <GenerateBriefForm courseId={course.id} materialIds={chosen} classAt={classAt} disabled={!ai.on || !course.aiAllowed || preview.tooLarge} />
        </section>
      )}

      <section aria-labelledby="briefs-heading" className={CARD}>
        <h2 id="briefs-heading" className="font-serif text-lg">
          Your briefs
        </h2>
        {briefs.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No briefs yet.</p>
        ) : (
          <ul className="mt-2">
            {briefs.map((b) => {
              const c = byId.get(b.courseId);
              return (
                <li key={b.id} className="border-b border-line py-2 text-sm last:border-b-0">
                  <Link href={`/prepare/briefs/${b.id}`} className="flex items-center gap-1.5 font-medium underline-offset-2 hover:underline">
                    {c && <CourseDot color={c.color} />}
                    {b.title}
                  </Link>
                  <span className="text-ink-muted">Made {formatDue(b.createdAt, now)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

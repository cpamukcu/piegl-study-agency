import Link from "next/link";
import { connection } from "next/server";
import { setTaskStatusAction } from "@/app/actions";
import { aiStatus } from "@/ai";
import { buildBriefPreview, MAX_MATERIAL_CHARS } from "@/ai/brief";
import { AiOffNote } from "@/components/ai-status-note";
import { CourseDot } from "@/components/course-dot";
import { EmptyState } from "@/components/empty-state";
import { GenerateBriefForm } from "@/components/generate-brief-form";
import { Icon } from "@/components/icons";
import { describeMaterial } from "@/components/material-list";
import { StatusPill } from "@/components/priority-pill";
import { SectionHeader } from "@/components/section-header";
import { BUTTON_GHOST, BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, CARD_LG, INPUT, LABEL } from "@/components/ui";
import { getDb } from "@/db/connection";
import { getCourse, listCourses } from "@/db/courses";
import { listMaterials } from "@/db/materials";
import { listMeetingTimes } from "@/db/meetings";
import { listRules, materializePrepTasks } from "@/db/rules";
import { listBriefs } from "@/db/study";
import { listTasks, type Task } from "@/db/tasks";
import { listTerms } from "@/db/terms";
import { requestTime } from "@/lib/clock";
import { clockOf, timeUntil } from "@/lib/day-plan";
import { sessionsBetween, type ClassSession } from "@/lib/sessions";
import { DAY_MS, formatDate, formatDue } from "@/lib/time";

type Search = Record<string, string | string[] | undefined>;
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const LINK = "font-semibold text-accent underline decoration-lilac underline-offset-4";

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

// Prepare Class: the next class and its checklist, then choose files, preview exactly what is sent, and make a brief.
export async function PrepareData({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  await connection();
  const db = getDb();
  const now = requestTime();
  materializePrepTasks(db, now);
  const ai = aiStatus();

  const courses = listCourses(db);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const sessions = sessionsBetween(listMeetingTimes(db), listTerms(db), now, now + 7 * DAY_MS).filter((s) => courseById.has(s.courseId));
  const tasks = listTasks(db, { includeDone: true });
  const briefs = listBriefs(db);
  const readableOf = (courseId: string) => listMaterials(db, courseId).filter((m) => m.extraction === "ok");

  const course = typeof params.course === "string" ? getCourse(db, params.course) : null;
  const at = Number(params.at);
  const classAt = Number.isFinite(at) && at > 0 ? at : null;
  const readable = course ? readableOf(course.id) : [];
  const chosen = many(params.m).filter((id) => readable.some((m) => m.id === id));
  const preview = course && chosen.length ? buildBriefPreview(db, course, chosen, classAt) : null;

  if (courses.length === 0) {
    return (
      <EmptyState title="No courses yet" art="books" action={<Link href="/courses" className={BUTTON_GHOST}>Add a course</Link>}>
        Add a course or import your ZJU data, then upload slides on the course page.
      </EmptyState>
    );
  }

  const next = sessions[0];
  const nextCourse = next ? courseById.get(next.courseId)! : null;
  const nextFiles = nextCourse ? readableOf(nextCourse.id) : [];
  const nextBrief = next ? (briefs.find((b) => b.courseId === next.courseId && b.classAt === next.startsAt) ?? null) : null;
  const prep = next ? prepFor(tasks, next) : null;
  const hasRoutine = nextCourse ? listRules(db, nextCourse.id).some((r) => r.active) : false;
  const later = sessions.slice(1, 6);

  return (
    <div className="space-y-6">
      {!ai.on && <AiOffNote />}

      {next && nextCourse ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section aria-labelledby="next-class-heading" className={`${CARD_LG} relative overflow-hidden`}>
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-52 w-72 rounded-full bg-wash blur-2xl" />
            <div className="relative flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-muted">Next class</p>
              {timeUntil(next.startsAt, now) && <StatusPill tone="lavender">{timeUntil(next.startsAt, now)}</StatusPill>}
            </div>
            <div className="relative mt-4 flex items-start gap-4">
              <span
                aria-hidden="true"
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `color-mix(in srgb, ${nextCourse.color} 14%, white)`, color: nextCourse.color }}
              >
                <Icon name="book" className="size-6" />
              </span>
              <div className="min-w-0">
                <h2 id="next-class-heading" className="text-2xl">
                  {nextCourse.title}
                </h2>
                <p className="mt-1 text-sm font-medium text-body">
                  {formatDue(next.startsAt, now)}–{clockOf(next.endsAt)}
                  {next.room ? ` · ${next.room}` : ""}
                </p>
              </div>
            </div>

            <h3 className="relative mt-7 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-muted">Before class</h3>
            <ul className="relative mt-1">
              <CheckItem done={nextBrief !== null} title="Class Ready Brief">
                {nextBrief ? (
                  <p className="mt-1 text-[13px] text-ink-muted">
                    <Link href={`/prepare/briefs/${nextBrief.id}`} className={LINK}>
                      Open the brief
                    </Link>{" "}
                    and mark the concepts you are unsure of.
                  </p>
                ) : nextFiles.length ? (
                  <>
                    <p className="mt-1 text-[13px] text-ink-muted">
                      {nextFiles.length} readable file{nextFiles.length === 1 ? "" : "s"} for this course.
                    </p>
                    <Link href={`/prepare?course=${nextCourse.id}&at=${next.startsAt}#choose-heading`} className={`${BUTTON_PRIMARY} mt-3`}>
                      <Icon name="sparkle" className="size-4" />
                      Make a brief
                    </Link>
                  </>
                ) : (
                  <p className="mt-1 text-[13px] text-ink-muted">
                    No slides yet.{" "}
                    <Link href={`/courses/${nextCourse.id}#materials-heading`} className={LINK}>
                      Upload slides or readings
                    </Link>
                  </p>
                )}
              </CheckItem>
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
                        <button type="submit" className={BUTTON_SECONDARY}>
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
                      <Link href={`/courses/${nextCourse.id}`} className={LINK}>
                        Add a prep routine
                      </Link>
                    )}
                  </p>
                )}
              </CheckItem>
            </ul>

            {(nextCourse.links.length > 0 || nextCourse.notes) && (
              <>
                <h3 className="relative mt-6 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-muted">Resources</h3>
                <ul className="relative mt-2 space-y-1.5 text-[13px]">
                  {nextCourse.links.map((link) => (
                    <li key={link} className="flex items-center gap-2">
                      <Icon name="link" className="size-3.5 text-faint" />
                      <a href={link} target="_blank" rel="noreferrer" className={`break-all ${LINK}`}>
                        {link}
                      </a>
                    </li>
                  ))}
                  {nextCourse.notes && <li className="max-w-prose text-body">{nextCourse.notes}</li>}
                </ul>
              </>
            )}
          </section>

          <div className="space-y-6">
            <section aria-labelledby="next-files-heading" className={CARD}>
              <SectionHeader id="next-files-heading" title="Class materials" action={{ href: `/courses/${nextCourse.id}#materials-heading`, label: "All files" }} />
              {nextFiles.length === 0 ? (
                <p className="rounded-[18px] bg-tint px-4 py-6 text-center text-sm text-ink-muted">
                  Slides and readings for {nextCourse.title} will show here once you upload them or ZJU sync finds them.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {nextFiles.slice(0, 6).map((m) => (
                    <li key={m.id} className="py-2.5">
                      <Link href={`/materials/${m.id}`} className="text-sm font-semibold text-ink hover:text-accent">
                        {m.title}
                      </Link>
                      <span className="block text-[13px] text-ink-muted">{describeMaterial(m)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
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
                        <Link href={`/prepare?course=${c.id}&at=${s.startsAt}#choose-heading`} className={BUTTON_GHOST} aria-label={`Prepare ${c.title}, ${formatDue(s.startsAt, now)}`}>
                          Prepare
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        </div>
      ) : (
        <EmptyState title="No classes coming up" art="calendar" action={<Link href="/courses" className={BUTTON_GHOST}>Add class times to a course</Link>}>
          Your next class and its preparation checklist will show here. You can still prepare any course below.
        </EmptyState>
      )}

      <section aria-labelledby="pick-course-heading" className={CARD}>
        <h2 id="pick-course-heading" className="text-lg">
          Prepare any course
        </h2>
        <form method="get" action="/prepare" className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="prepare-course" className={LABEL}>
              Course
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
            Choose files
          </button>
        </form>
      </section>

      {course && (
        <section aria-labelledby="choose-heading" className={CARD}>
          <h2 id="choose-heading" className="text-lg">
            {course.title}
            {classAt ? `, ${formatDate(classAt)}` : ""}: choose material
          </h2>
          {!course.aiAllowed && (
            <p className="mt-2 text-sm text-warn">AI is turned off for this course, so nothing from it can be sent. Change this on the course page.</p>
          )}
          {readable.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              No readable files yet.{" "}
              <Link href={`/courses/${course.id}#materials-heading`} className={LINK}>
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
                <ul className="divide-y divide-line">
                  {readable.map((m) => (
                    <li key={m.id}>
                      <label className="flex items-start gap-3 py-2.5 text-sm">
                        <input type="checkbox" name="m" value={m.id} defaultChecked={chosen.includes(m.id)} className="mt-1 size-4 accent-[#6a4fd6]" />
                        <span>
                          <span className="font-semibold text-ink">{m.title}</span>
                          <span className="block text-[13px] text-ink-muted">{describeMaterial(m)}</span>
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
          <h2 id="preview-heading" className="text-lg">
            What will be sent
          </h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-ink-muted">To</dt>
            <dd className="text-ink">{ai.on ? `${ai.name}, model ${ai.model}` : "Nobody: AI is off"}</dd>
            <dt className="text-ink-muted">Text</dt>
            <dd className="text-ink">
              {preview.pages.length} pages from {chosen.length} file{chosen.length === 1 ? "" : "s"}, {preview.chars.toLocaleString("en")} characters (about{" "}
              {Math.ceil(preview.chars / 4).toLocaleString("en")} tokens)
            </dd>
            <dt className="text-ink-muted">Not sent</dt>
            <dd className="text-ink">Your tasks, notes, other courses, file names on disk, and anything about you.</dd>
          </dl>
          {preview.tooLarge && (
            <p className="mt-2 text-sm text-warn">That is over the {MAX_MATERIAL_CHARS.toLocaleString("en")}-character limit. Choose fewer files.</p>
          )}
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-accent">Instructions sent with it</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-[14px] bg-tint p-3 font-mono text-xs ring-1 ring-line">{preview.system}</pre>
          </details>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer font-semibold text-accent">Full text sent</summary>
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-[14px] bg-tint p-3 font-mono text-xs ring-1 ring-line">{preview.prompt}</pre>
          </details>
          <GenerateBriefForm courseId={course.id} materialIds={chosen} classAt={classAt} disabled={!ai.on || !course.aiAllowed || preview.tooLarge} />
        </section>
      )}

      <section aria-labelledby="briefs-heading" className={CARD}>
        <SectionHeader id="briefs-heading" title="Your briefs" count={briefs.length} />
        {briefs.length === 0 ? (
          <p className="rounded-[18px] bg-tint px-4 py-6 text-center text-sm text-ink-muted">No briefs yet. Make one from your next class above.</p>
        ) : (
          <ul className="divide-y divide-line">
            {briefs.map((b) => {
              const c = courseById.get(b.courseId);
              return (
                <li key={b.id} className="flex items-center gap-3 py-3">
                  {c && <CourseDot color={c.color} />}
                  <span className="min-w-0 flex-1">
                    <Link href={`/prepare/briefs/${b.id}`} className="block truncate text-sm font-semibold text-ink hover:text-accent">
                      {b.title}
                    </Link>
                    <span className="block text-[13px] text-ink-muted">Made {formatDue(b.createdAt, now)}</span>
                  </span>
                  <Icon name="chevron-right" className="size-4 text-faint" />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

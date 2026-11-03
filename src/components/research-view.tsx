import { notFound } from "next/navigation";
import { connection } from "next/server";
import { deleteNoteAction, deleteProjectAction, deleteSourceAction, setSourceVerifiedAction } from "@/app/actions";
import { aiStatus } from "@/ai";
import { DetailHeader } from "@/components/detail-header";
import { NoteForm, PlanButton, SourceForm } from "@/components/research-forms";
import { BUTTON_DANGER, BUTTON_SECONDARY, CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { getCourse } from "@/db/courses";
import { getProject, listNotes, listSources, type Note, type Source } from "@/db/research";
import { requestTime } from "@/lib/clock";
import { formatDue } from "@/lib/time";

function locatorHref(locator: string): string | null {
  if (/^https?:\/\//i.test(locator)) return locator;
  const doi = /^(?:doi:\s*)?(10\.\d{4,9}\/\S+)$/i.exec(locator)?.[1];
  return doi ? `https://doi.org/${doi}` : null;
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-1 list-disc pl-5 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function NoteLabel({ note, sources }: { note: Note; sources: Map<string, Source> }) {
  const base = "mr-2 rounded-full px-2 py-0.5 text-xs";
  if (note.label === "mine") return <span className={`${base} bg-lavender-50`}>Mine</span>;
  if (note.label === "ai-interpretation") return <span className={`${base} border border-line`}>AI interpretation</span>;
  return <span className={`${base} bg-lavender-50`}>From: {sources.get(note.sourceId ?? "")?.title ?? "source"}</span>;
}

export async function ResearchView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const db = getDb();
  const now = requestTime();
  const project = getProject(db, id);
  if (!project) notFound();
  const course = project.courseId ? getCourse(db, project.courseId) : null;
  const sources = listSources(db, id);
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const notes = listNotes(db, id);
  const ai = aiStatus();
  const plan = project.plan;

  return (
    <div className="space-y-6">
      <DetailHeader title={project.question} icon="research" color={course?.color} eyebrow={course ? course.title : "Research question"} />

      <section aria-labelledby="plan-heading" className={CARD}>
        <h2 id="plan-heading" className="text-lg">
          Plan
        </h2>
        {plan ? (
          <>
            <p className="mt-2 rounded-[14px] border border-line px-3 py-2 text-sm">
              <strong>AI interpretation</strong> by {project.planModel}. Suggestions for how to search, not findings. It names no sources on purpose.
            </p>
            <List title="Smaller questions" items={plan.subquestions} />
            <List title="Search terms" items={plan.searchTerms} />
            <List title="Perspectives to compare" items={plan.perspectives} />
            <List title="Where to look" items={plan.whereToLook} />
            <List title="Steps" items={plan.steps} />
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Break the question into smaller ones, find search terms, and decide which perspectives to compare. You can ask for a suggestion.
          </p>
        )}
        <p className="mt-3 text-xs text-ink-muted">
          {ai.on
            ? course && !course.aiAllowed
              ? "AI is off for this course."
              : `Sends only your question${course ? " and the course name" : ""} to ${ai.name}.`
            : "AI is off: add ANTHROPIC_API_KEY to .env.local to get suggestions."}
        </p>
        <PlanButton projectId={project.id} disabled={!ai.on || Boolean(course && !course.aiAllowed)} again={Boolean(plan)} />
      </section>

      <section aria-labelledby="sources-heading" className={CARD}>
        <h2 id="sources-heading" className="text-lg">
          Sources ({sources.filter((s) => s.verifiedAt).length} of {sources.length} verified)
        </h2>
        <p className="mt-2 text-sm text-ink-muted">Only you add sources. Mark one verified after you have opened it and checked it says what you think.</p>
        {sources.length > 0 && (
          <ul className="mt-2">
            {sources.map((s) => {
              const href = s.locator ? locatorHref(s.locator) : null;
              return (
                <li key={s.id} className="border-b border-line py-3 text-sm last:border-b-0">
                  <p className="font-medium">
                    {s.title}
                    {s.verifiedAt ? (
                      <span className="ml-2 rounded-full bg-mint-50 px-2.5 py-0.5 text-xs font-semibold text-mint-ink">Verified {formatDue(s.verifiedAt, now)}</span>
                    ) : (
                      <span className="ml-2 rounded-full bg-coral-50 px-2.5 py-0.5 text-xs font-semibold text-coral-ink">Not verified</span>
                    )}
                  </p>
                  <p className="text-ink-muted">
                    {[s.authors, s.year, ["", "Low", "Medium", "High"][s.relevance] + " relevance"].filter(Boolean).join(" · ")}
                  </p>
                  {s.locator &&
                    (href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">
                        {s.locator}
                      </a>
                    ) : (
                      <p className="break-all">{s.locator}</p>
                    ))}
                  {s.notes && <p className="mt-1">{s.notes}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <form action={setSourceVerifiedAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="verified" value={s.verifiedAt ? "0" : "1"} />
                      <button type="submit" className={BUTTON_SECONDARY}>
                        {s.verifiedAt ? "Mark not verified" : "I checked it: mark verified"}
                      </button>
                    </form>
                    <form action={deleteSourceAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className={BUTTON_SECONDARY} aria-label={`Delete source ${s.title}`}>
                        Delete
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <SourceForm projectId={project.id} />
      </section>

      <section aria-labelledby="notes-heading" className={CARD}>
        <h2 id="notes-heading" className="text-lg">
          Notes
        </h2>
        <p className="mt-2 text-sm text-ink-muted">Every note says whose idea it is, so you never mix up your thinking, a source, and an AI.</p>
        {notes.length > 0 && (
          <ul className="mt-2">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 border-b border-line py-3 text-sm last:border-b-0">
                <p className="whitespace-pre-line">
                  <NoteLabel note={n} sources={sourceById} />
                  {n.body}
                </p>
                <form action={deleteNoteAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button type="submit" className={BUTTON_SECONDARY} aria-label="Delete note">
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <NoteForm projectId={project.id} sources={sources.map((s) => ({ id: s.id, title: s.title }))} />
      </section>

      <section aria-labelledby="delete-project-heading" className={CARD}>
        <h2 id="delete-project-heading" className="text-lg">
          Delete research question
        </h2>
        <p className="mt-2 text-sm text-ink-muted">Deletes its plan, sources and notes.</p>
        <form action={deleteProjectAction} className="mt-3">
          <input type="hidden" name="id" value={project.id} />
          <button type="submit" className={BUTTON_DANGER}>
            Delete
          </button>
        </form>
      </section>
    </div>
  );
}

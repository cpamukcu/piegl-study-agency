import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { deleteBriefAction } from "@/app/actions";
import { ConceptMarks } from "@/components/concept-marks";
import { DetailHeader } from "@/components/detail-header";
import { PageRefs } from "@/components/page-refs";
import { BUTTON_DANGER, BUTTON_SECONDARY, CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { getCourse } from "@/db/courses";
import { getMaterial, type Material } from "@/db/materials";
import { getBrief, listConcepts, listFlashcards, listQuestions } from "@/db/study";
import { requestTime } from "@/lib/clock";
import { formatDue } from "@/lib/time";

const KIND_LABELS = { recall: "Recall", explain: "Explain", apply: "Apply", critique: "Critique" } as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={CARD}>
      <h2 id={id} className="text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}

export async function BriefView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const db = getDb();
  const brief = getBrief(db, id);
  if (!brief) notFound();
  const course = getCourse(db, brief.courseId);
  const materials = new Map(brief.materialIds.flatMap((mid) => {
    const m = getMaterial(db, mid);
    return m ? [[mid, m] as [string, Material]] : [];
  }));
  const concepts = listConcepts(db, { briefId: id });
  const cards = listFlashcards(db, id);
  const questions = listQuestions(db, { briefId: id });
  const s = brief.sections;

  return (
    <div className="space-y-6">
      <DetailHeader
        title={brief.title}
        icon="prepare"
        color={course?.color}
        eyebrow={
          course ? (
            <Link href={`/courses/${course.id}`} className="hover:text-accent">
              {course.title}
            </Link>
          ) : (
            "Class Ready Brief"
          )
        }
      >
        <p className="max-w-prose rounded-[16px] bg-surface-soft p-4 text-body">
          <strong className="text-ink">AI interpretation</strong> by {brief.model}, made {formatDue(brief.createdAt, requestTime())}. Every point links to the page
          it came from: check it there before you rely on it.
          {s.removed > 0 && ` ${s.removed} item${s.removed === 1 ? " was" : "s were"} left out because ${s.removed === 1 ? "it" : "they"} pointed to no real page.`}
        </p>
        <p className="text-ink-muted">From: {[...materials.values()].map((m) => m.title).join(", ") || "files since deleted"}</p>
      </DetailHeader>

      <Section id="overview-heading" title="Overview">
        <p className="mt-2 max-w-prose text-sm leading-relaxed">{s.overview}</p>
      </Section>

      <Section id="points-heading" title="Key points">
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
          {s.keyPoints.map((k, i) => (
            <li key={i}>
              {k.text}
              <PageRefs refs={k.refs} materials={materials} />
            </li>
          ))}
        </ol>
      </Section>

      <Section id="concepts-heading" title="Concepts: mark how well you know each">
        <ConceptMarks concepts={concepts} materials={materials} />
      </Section>

      {s.askInClass.length > 0 && (
        <Section id="ask-heading" title="Questions you could raise in class">
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            {s.askInClass.map((q, i) => (
              <li key={i}>
                {q.text}
                <PageRefs refs={q.refs} materials={materials} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="cards-heading" title={`Flashcards (${cards.length})`}>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <li key={c.id}>
              <details className="h-full rounded-[14px] border border-line p-3 text-sm">
                <summary className="cursor-pointer font-medium">{c.front}</summary>
                <p className="mt-2">
                  {c.back}
                  <PageRefs refs={c.refs} materials={materials} />
                </p>
              </details>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="practice-heading" title="Practice with Professor Mode">
        <ul className="mt-2">
          {questions.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
              <span>
                <span className="mr-2 rounded-full bg-lavender-50 px-2 py-0.5 text-xs">{KIND_LABELS[q.kind]}</span>
                {q.question}
              </span>
              <Link href={`/practice?q=${q.id}`} className={BUTTON_SECONDARY}>
                Answer
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <section aria-labelledby="delete-brief-heading" className={CARD}>
        <h2 id="delete-brief-heading" className="text-lg">
          Delete brief
        </h2>
        <p className="mt-2 text-sm text-ink-muted">Your concept marks and practice answers are kept.</p>
        <form action={deleteBriefAction} className="mt-3">
          <input type="hidden" name="id" value={brief.id} />
          <button type="submit" className={BUTTON_DANGER}>
            Delete brief
          </button>
        </form>
      </section>
    </div>
  );
}

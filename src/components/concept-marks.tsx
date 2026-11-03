import { setConceptStatusAction } from "@/app/actions";
import { PageRefs } from "@/components/page-refs";
import type { Material } from "@/db/materials";
import { CONCEPT_STATUSES, type Concept } from "@/db/study";

const LABELS: Record<Concept["status"], string> = { understand: "I understand", review: "Review", confusing: "Confusing" };

export function ConceptMarks({ concepts, materials }: { concepts: Concept[]; materials: Map<string, Material> }) {
  return (
    <ul className="mt-2">
      {concepts.map((c) => (
        <li key={c.id} className="border-b border-line py-3 text-sm last:border-b-0">
          <p>
            <span className="font-semibold">{c.term}</span>: {c.definition}
            <PageRefs refs={c.refs} materials={materials} />
          </p>
          <form action={setConceptStatusAction} className="mt-2 flex flex-wrap gap-2" aria-label={`Mark ${c.term}`}>
            <input type="hidden" name="id" value={c.id} />
            {CONCEPT_STATUSES.map((s) => (
              <button
                key={s}
                type="submit"
                name="status"
                value={s}
                aria-pressed={c.status === s}
                className={`rounded-full border px-3 py-1 text-xs ${c.status === s ? (s === "confusing" ? "border-warn bg-warn text-white" : "border-brand bg-brand text-white") : "border-line hover:bg-surface-strong"}`}
              >
                {LABELS[s]}
              </button>
            ))}
          </form>
        </li>
      ))}
    </ul>
  );
}

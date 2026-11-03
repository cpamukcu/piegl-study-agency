import { PageRefs } from "@/components/page-refs";
import type { Material } from "@/db/materials";
import type { Attempt } from "@/db/study";

const Score = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl bg-paper px-3 py-2 text-center">
    <dd className={`text-xl font-semibold ${value <= 2 ? "text-warn" : ""}`}>{value}/5</dd>
    <dt className="text-xs text-ink-muted">{label}</dt>
  </div>
);

export function AssessmentView({ attempt, materials }: { attempt: Attempt; materials: Map<string, Material> }) {
  const a = attempt.assessment;
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-3 gap-2" aria-label="Scores">
        <Score label="Accuracy" value={a.accuracy} />
        <Score label="Clarity" value={a.clarity} />
        <Score label="Evidence" value={a.evidence} />
      </dl>
      {a.strengths.length > 0 && (
        <div>
          <h3 className="font-semibold">What worked</h3>
          <ul className="mt-1 list-disc pl-5">
            {a.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {a.missing.length > 0 && (
        <div>
          <h3 className="font-semibold">Missing or wrong</h3>
          <ul className="mt-1 list-disc pl-5">
            {a.missing.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h3 className="font-semibold">Outline of a strong answer (notes, not a script)</h3>
        <ul className="mt-1 space-y-1">
          {a.outline.map((o, i) => (
            <li key={i} className="flex gap-2">
              <span className={`h-fit shrink-0 rounded-full px-2 py-0.5 text-xs ${o.label === "fact" ? "bg-surface-strong" : "border border-line"}`}>
                {o.label === "fact" ? "Fact" : "Interpretation"}
              </span>
              <span>
                {o.point}
                <PageRefs refs={o.refs} materials={materials} />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p>
        <span className="font-semibold">The professor might follow up: </span>
        {a.followUp}
      </p>
      <p className="text-xs text-ink-muted">AI assessment by {attempt.model}. Use it as a sparring partner, not a grade.</p>
    </div>
  );
}

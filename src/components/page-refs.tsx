import Link from "next/link";
import type { Material, PageRef } from "@/db/materials";

// Links each reference to the page in the material viewer. Unknown files (deleted since) show as plain text.
export function PageRefs({ refs, materials }: { refs: PageRef[]; materials: Map<string, Material> }) {
  if (refs.length === 0) return null;
  return (
    <span className="ml-1 text-xs text-ink-muted">
      (
      {refs.map((r, i) => {
        const m = materials.get(r.materialId);
        const label = `${m?.title ?? "deleted file"}, ${m?.kind === "pptx" ? "slide" : "p."} ${r.page}`;
        return (
          <span key={`${r.materialId}-${r.page}`}>
            {i > 0 && "; "}
            {m ? (
              <Link href={`/materials/${m.id}#p-${r.page}`} className="underline underline-offset-2 hover:text-ink">
                {label}
              </Link>
            ) : (
              label
            )}
          </span>
        );
      })}
      )
    </span>
  );
}

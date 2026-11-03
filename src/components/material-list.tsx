import Link from "next/link";
import { deleteMaterialAction } from "@/app/actions";
import { BUTTON_SECONDARY } from "@/components/ui";
import type { Material } from "@/db/materials";

const STATUS: Record<Material["extraction"], string> = {
  ok: "",
  "no-text": "no text layer (scanned)",
  failed: "could not be read",
  unsupported: "kept, not readable here",
};

export function describeMaterial(m: Material): string {
  const parts = [m.kind === "pptx" ? `${m.pageCount ?? "?"} slides` : m.pageCount ? `${m.pageCount} pages` : m.kind.toUpperCase()];
  if (m.source === "zju") parts.push("from Courses@ZJU");
  if (STATUS[m.extraction]) parts.push(STATUS[m.extraction]);
  return parts.join(" · ");
}

export function MaterialList({ materials, canDelete = true }: { materials: Material[]; canDelete?: boolean }) {
  if (materials.length === 0) return <p className="mt-2 text-sm text-ink-muted">No files yet.</p>;
  return (
    <ul className="mt-2">
      {materials.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
          <span className="min-w-0">
            <Link href={`/materials/${m.id}`} className="font-medium underline-offset-2 hover:underline">
              {m.title}
            </Link>
            <span className="block text-ink-muted">{describeMaterial(m)}</span>
          </span>
          {canDelete && (
            <form action={deleteMaterialAction}>
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" className={BUTTON_SECONDARY} aria-label={`Delete ${m.title}`}>
                Delete
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

import { INTEGRITY_TEXT } from "@/lib/integrity";

export function IntegrityNote() {
  return (
    <aside aria-label="Academic integrity" className="rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed">
      <p className="font-medium">Academic integrity</p>
      <p className="mt-1 max-w-prose text-ink-muted">{INTEGRITY_TEXT}</p>
    </aside>
  );
}

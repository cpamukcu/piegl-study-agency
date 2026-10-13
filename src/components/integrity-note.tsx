import { Icon } from "@/components/icons";
import { INTEGRITY_TEXT } from "@/lib/integrity";

export function IntegrityNote() {
  return (
    <aside aria-label="Academic integrity" className="flex gap-4 rounded-[24px] bg-surface-soft p-5 text-sm leading-relaxed sm:p-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-lavender shadow-card">
        <Icon name="shield" />
      </span>
      <div>
        <p className="font-semibold text-ink">Academic integrity</p>
        <p className="mt-1 max-w-prose text-body">{INTEGRITY_TEXT}</p>
      </div>
    </aside>
  );
}

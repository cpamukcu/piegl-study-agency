import Link from "next/link";
import { Icon } from "@/components/icons";

type SectionHeaderProps = { id?: string; title: string; action?: { href: string; label: string }; count?: number };

export function SectionHeader({ id, title, action, count }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2 id={id} className="text-lg leading-tight sm:text-xl">
        {title}
        {count !== undefined && <span className="ml-2 text-sm font-semibold text-ink-muted">({count})</span>}
      </h2>
      {action && (
        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[13px] font-semibold text-accent hover:bg-lavender-50"
        >
          {action.label}
          <Icon name="chevron-right" className="size-4" />
        </Link>
      )}
    </div>
  );
}

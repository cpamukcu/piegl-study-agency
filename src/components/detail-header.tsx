import { Icon, type IconName } from "@/components/icons";

// The header card for a single item (a brief, a file, a research question), in the course page's style.
export function DetailHeader({ title, color, icon, eyebrow, children }: { title: string; color?: string; icon: IconName; eyebrow?: React.ReactNode; children?: React.ReactNode }) {
  const tint = color ?? "#9a75ee";
  return (
    <header className="relative overflow-hidden rounded-[28px] bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-8">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: tint }} />
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-48 w-64 rounded-full bg-wash blur-2xl" />
      <div className="relative flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `color-mix(in srgb, ${tint} 14%, white)`, color: tint }}
        >
          <Icon name={icon} className="size-6" />
        </span>
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-[13px] font-semibold text-ink-muted">{eyebrow}</div>}
          <h1 className="text-[26px] leading-tight tracking-tight sm:text-[32px]">{title}</h1>
        </div>
      </div>
      {children && <div className="relative mt-4 space-y-3 text-sm">{children}</div>}
    </header>
  );
}

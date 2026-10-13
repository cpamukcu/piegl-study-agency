import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

export type QuickAction = { href: string; label: string; icon: IconName };

// A row of friendly action tiles. The first is the highlighted one. On phones the row
// scrolls sideways, with a fade on the right edge to show there is more.
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <section aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading" className="mb-3 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-muted">
        Quick actions
      </h2>
      <div className="relative -mx-5 md:mx-0">
        <nav aria-label="Quick actions" className="scroll-row -my-4 flex gap-3 overflow-x-auto px-5 py-4 md:my-0 md:grid md:grid-cols-3 md:py-0 lg:grid-cols-5 md:overflow-visible md:px-0">
          {actions.map((action, i) => (
            <Link
              key={action.href}
              href={action.href}
              className={`lift flex h-[104px] w-[112px] shrink-0 flex-col justify-between rounded-[20px] p-4 text-[14px] font-semibold leading-tight shadow-card md:w-auto ${
                i === 0 ? "bg-action text-white" : "bg-surface text-ink ring-1 ring-line"
              }`}
            >
              <span
                className={`flex size-9 items-center justify-center rounded-xl ${i === 0 ? "bg-white/20 text-white" : "bg-lavender-50 text-lavender"}`}
              >
                <Icon name={action.icon} className="size-5" />
              </span>
              {action.label}
            </Link>
          ))}
        </nav>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent md:hidden" />
      </div>
    </section>
  );
}

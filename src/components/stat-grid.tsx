import { Icon, type IconName } from "@/components/icons";

export type Stat = { label: string; value: string; icon: IconName; tint: string; warn?: boolean };

// One elevated white card with four equal metrics: 2x2 on phones, one row on wider screens.
export function StatGrid({ stats, label }: { stats: Stat[]; label: string }) {
  return (
    <dl aria-label={label} className="relative grid grid-cols-2 rounded-[24px] bg-surface shadow-card ring-1 ring-line/70 md:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`flex flex-col-reverse items-center justify-end gap-1 px-3 py-5 text-center ${i % 2 === 0 ? "border-r border-line" : ""} ${
            i < 2 ? "border-b border-line md:border-b-0" : ""
          } md:border-r md:last:border-r-0`}
        >
          <dt className="text-[13px] font-medium text-ink-muted">{stat.label}</dt>
          <dd className={`flex items-center gap-2 font-display text-[28px] font-bold leading-none ${stat.warn ? "text-coral-ink" : "text-ink"}`}>
            <span className={`flex size-7 items-center justify-center rounded-full ${stat.tint}`} aria-hidden="true">
              <Icon name={stat.icon} className="size-4" />
            </span>
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

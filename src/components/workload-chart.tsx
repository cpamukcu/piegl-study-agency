import { CARD } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { describeLoad, type WeekLoad } from "@/lib/workload";

function weekLabel(index: number, weekStart: number): string {
  if (index === 0) return "This week";
  if (index === 1) return "Next week";
  return `Week of ${formatDate(weekStart)}`;
}

export function WorkloadChart({ weeks }: { weeks: WeekLoad[] }) {
  const max = Math.max(60, ...weeks.map((w) => w.minutes));
  return (
    <section aria-labelledby="workload-heading" className={CARD}>
      <h2 id="workload-heading" className="font-serif text-lg">
        Weekly workload
      </h2>
      <ul className="mt-4 space-y-3">
        {weeks.map((week, i) => (
          <li key={week.weekStart}>
            <div className="flex flex-wrap justify-between gap-x-4 text-sm">
              <span>{weekLabel(i, week.weekStart)}</span>
              <span className="text-ink-muted">{describeLoad(week)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-surface-strong" aria-hidden="true">
              <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.round((week.minutes / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

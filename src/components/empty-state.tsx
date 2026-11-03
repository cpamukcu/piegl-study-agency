import { Icon, type IconName } from "@/components/icons";
import { Scene, type SceneName } from "@/components/scene";

type EmptyStateProps = { title: string; children: React.ReactNode; art?: SceneName; icon?: IconName; action?: React.ReactNode };

// A gentle placeholder: a small drawing or icon, a heading, one encouraging line, and an optional next step.
export function EmptyState({ title, children, art, icon, action }: EmptyStateProps) {
  return (
    <section className={`rounded-[24px] bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-7 ${art ? "text-center" : ""}`}>
      {art && <Scene name={art} />}
      {!art && icon && (
        <span className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-lavender-50 text-lavender">
          <Icon name={icon} />
        </span>
      )}
      <h2 className={`text-lg ${art ? "mt-3" : ""}`}>{title}</h2>
      <div className={`mt-1.5 text-sm leading-relaxed text-ink-muted ${art ? "mx-auto max-w-xs" : "max-w-prose"}`}>{children}</div>
      {action && <div className={`mt-4 ${art ? "flex justify-center" : ""}`}>{action}</div>}
    </section>
  );
}

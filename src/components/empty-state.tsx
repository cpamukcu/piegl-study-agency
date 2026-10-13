import { Scene, type SceneName } from "@/components/scene";

type EmptyStateProps = { title: string; children: React.ReactNode; art?: SceneName };

export function EmptyState({ title, children, art }: EmptyStateProps) {
  return (
    <section className={`rounded-[20px] bg-surface p-6 shadow-soft ${art ? "text-center" : ""}`}>
      {art && <Scene name={art} />}
      <h2 className={`text-lg ${art ? "mt-3" : ""}`}>{title}</h2>
      <div className={`mt-2 text-sm leading-relaxed text-ink-muted ${art ? "mx-auto max-w-xs" : "max-w-prose"}`}>{children}</div>
    </section>
  );
}

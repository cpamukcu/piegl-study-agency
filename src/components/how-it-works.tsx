import { Icon, type IconName } from "@/components/icons";

export type Step = { icon: IconName; title: string; text: string };

// A short, friendly explanation of a feature that is still on its way.
export function HowItWorks({ label, steps }: { label: string; steps: Step[] }) {
  return (
    <section aria-label={label} className="rounded-[24px] bg-surface-soft p-5 ring-1 ring-line sm:p-6">
      <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-muted">{label}</p>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-lavender shadow-card">
              <Icon name={step.icon} />
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-ink">
                <span className="sr-only">Step {i + 1}: </span>
                {step.title}
              </span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-muted">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

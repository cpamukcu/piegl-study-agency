import Link from "next/link";
import { Icon } from "@/components/icons";
import { BUTTON_WHITE } from "@/components/ui";
import type { Progress } from "@/lib/day-plan";

type GradientHeroProps = {
  eyebrow: string;
  headline: string;
  message: string;
  progress: Progress | null;
  action: { href: string; label: string };
  aside?: React.ReactNode;
};

function ProgressRing({ progress }: { progress: Progress }) {
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const share = progress.total ? progress.done / progress.total : 0;
  return (
    <figure className="flex items-center gap-4">
      <svg viewBox="0 0 84 84" className="size-[84px] -rotate-90" aria-hidden="true">
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="8" />
        {share > 0 && (
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${circumference * share} ${circumference}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
        )}
      </svg>
      <figcaption className="text-white">
        <span className="block font-display text-[26px] font-bold leading-none">
          {progress.done}
          <span className="text-lg font-semibold text-white/80"> / {progress.total}</span>
        </span>
        <span className="mt-1.5 block text-sm font-medium text-white/90">
          {progress.done} of {progress.total} done {progress.scope}
        </span>
      </figcaption>
    </figure>
  );
}

// The Today hero: the one place the full brand gradient is used.
export function GradientHero({ eyebrow, headline, message, progress, action, aside }: GradientHeroProps) {
  return (
    <section aria-label="Your day at a glance" className="relative overflow-hidden rounded-[28px] bg-hero text-white shadow-lift">
      {/* A light ink shade on the left keeps white text readable over the pastel gradient. */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(42,31,92,0.24)_0%,rgba(42,31,92,0.12)_55%,rgba(42,31,92,0)_100%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-16 -top-24 size-72 rounded-full bg-white/10" />
        <div className="absolute -right-4 top-10 size-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-28 left-1/3 size-72 rounded-full bg-[#ef70b7]/25 blur-3xl" />
        <div className="absolute -left-20 -top-20 size-64 rounded-full bg-[#6b7de5]/40 blur-3xl" />
        <svg className="absolute right-[38%] top-6 size-4 text-white/50" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
        </svg>
        <svg className="absolute bottom-8 right-[46%] size-2.5 text-white/40" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
        </svg>
      </div>

      <div className="relative grid gap-7 p-6 pb-14 sm:p-8 sm:pb-16 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10 lg:p-10 lg:pb-16">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ring-1 ring-white/25">
            <Icon name="sparkle" className="size-3.5" />
            {eyebrow}
          </p>
          <p className="mt-4 max-w-xl font-display text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">{headline}</p>
          <p className="mt-2 max-w-lg text-base font-medium leading-relaxed text-white/90">{message}</p>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <Link href={action.href} className={BUTTON_WHITE}>
              {action.label}
              <Icon name="arrow-right" className="size-4" />
            </Link>
            {progress && progress.total > 0 && (
              <div className="lg:hidden">
                <ProgressRing progress={progress} />
              </div>
            )}
          </div>
        </div>
        {(aside || (progress && progress.total > 0)) && (
          <div className="hidden flex-col gap-4 lg:flex">
            {progress && progress.total > 0 && (
              <div className="rounded-[22px] bg-white/15 p-5 ring-1 ring-white/25 backdrop-blur-md">
                <ProgressRing progress={progress} />
              </div>
            )}
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}

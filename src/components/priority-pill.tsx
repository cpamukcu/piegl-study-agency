import { PILL } from "@/components/ui";

export type Tone = "lavender" | "periwinkle" | "sky" | "mint" | "amber" | "coral" | "neutral";

const TONES: Record<Tone, string> = {
  lavender: "bg-lavender-50 text-accent",
  periwinkle: "bg-periwinkle-50 text-periwinkle-ink",
  sky: "bg-sky-50 text-periwinkle-ink",
  mint: "bg-mint-50 text-mint-ink",
  amber: "bg-amber-50 text-amber-ink",
  coral: "bg-coral-50 text-coral-ink",
  neutral: "bg-tint text-ink-muted ring-1 ring-line",
};

// A small status label. Always carries words, so colour is never the only signal.
export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`${PILL} ${TONES[tone]}`}>{children}</span>;
}

export function PriorityPill({ importance }: { importance: 1 | 2 | 3 }) {
  if (importance === 3) return <StatusPill tone="coral">High</StatusPill>;
  if (importance === 1) return <StatusPill tone="neutral">Low</StatusPill>;
  return null;
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const BUTTON_PRIMARY = `inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-soft disabled:opacity-60 ${FOCUS}`;
export const BUTTON_SECONDARY = `inline-flex items-center justify-center rounded-xl bg-surface-strong px-3 py-2 text-sm font-medium text-accent hover:brightness-95 ${FOCUS}`;
export const BUTTON_DANGER = `inline-flex items-center justify-center rounded-xl border border-warn px-3 py-2 text-sm font-medium text-warn hover:bg-surface-strong ${FOCUS}`;
export const INPUT = `mt-1 block w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink aria-[invalid=true]:border-warn ${FOCUS}`;
export const LABEL = "block text-sm font-medium";
export const CARD = "rounded-[20px] bg-surface p-4 shadow-soft sm:p-6";

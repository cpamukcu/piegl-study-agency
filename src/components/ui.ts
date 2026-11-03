// Shared class strings. Components compose these instead of repeating raw styles.
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const PRESS = "transition duration-200 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";

export const BUTTON_PRIMARY = `inline-flex items-center justify-center gap-2 rounded-[14px] bg-action px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:shadow-lift ${PRESS} ${FOCUS}`;
export const BUTTON_SECONDARY = `inline-flex items-center justify-center gap-2 rounded-[12px] bg-lavender-50 px-3.5 py-2 text-sm font-semibold text-accent hover:bg-[#ebe4fd] ${PRESS} ${FOCUS}`;
export const BUTTON_GHOST = `inline-flex items-center justify-center gap-1.5 rounded-[12px] px-3 py-2 text-sm font-semibold text-accent hover:bg-lavender-50 ${PRESS} ${FOCUS}`;
export const BUTTON_DANGER = `inline-flex items-center justify-center gap-2 rounded-[12px] border border-coral/60 bg-surface px-3.5 py-2 text-sm font-semibold text-coral-ink hover:bg-coral-50 ${PRESS} ${FOCUS}`;
export const BUTTON_WHITE = `inline-flex items-center justify-center gap-2 rounded-[16px] bg-white px-4 py-2.5 text-sm font-semibold text-accent shadow-card hover:shadow-lift ${PRESS} ${FOCUS}`;
export const ICON_BUTTON = `inline-flex size-10 items-center justify-center rounded-full bg-surface text-ink-muted shadow-card hover:text-accent hover:shadow-lift ${PRESS} ${FOCUS}`;

export const INPUT = `mt-1.5 block w-full rounded-[12px] border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint transition-shadow duration-150 focus:border-lavender focus:outline-none focus:ring-4 focus:ring-lavender/20 aria-[invalid=true]:border-coral aria-[invalid=true]:ring-coral/15`;
export const LABEL = "block text-sm font-semibold text-ink";

// Major cards (24px) and standard cards (18px).
export const CARD_LG = "rounded-[24px] bg-surface p-5 shadow-card ring-1 ring-line/70 sm:p-7";
export const CARD = "rounded-[24px] bg-surface p-5 shadow-card ring-1 ring-line/70 sm:p-6";
export const CARD_SM = "rounded-[18px] bg-surface p-4 shadow-card ring-1 ring-line/70";

export const PILL = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em]";
export const CARD_TITLE = "text-[17px] font-bold text-ink";
export const META = "text-[13px] font-medium text-ink-muted";

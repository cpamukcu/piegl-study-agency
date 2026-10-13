import type { ClassSession } from "@/lib/sessions";
import { DAY_MS, MINUTE_MS, formatDate } from "@/lib/time";

export const PREP_HORIZON_MS = 14 * DAY_MS;

export type PrepOccurrence = { occurrenceKey: string; title: string; dueAt: number };

type RuleShape = { courseId: string; title: string; leadMinutes: number };

// Too late for the usual lead time: due when class starts, rather than overdue at once.
function dueFor(startsAt: number, leadMinutes: number, now: number): number {
  const usual = startsAt - leadMinutes * MINUTE_MS;
  return usual > now ? usual : startsAt;
}

export function prepOccurrences(
  rule: RuleShape,
  sessions: ClassSession[],
  now: number,
  horizonMs = PREP_HORIZON_MS,
): PrepOccurrence[] {
  return sessions
    .filter((s) => s.courseId === rule.courseId && s.startsAt > now && s.startsAt <= now + horizonMs)
    .map((s) => ({
      occurrenceKey: String(s.startsAt),
      title: `${rule.title} · ${formatDate(s.startsAt)}`,
      dueAt: dueFor(s.startsAt, rule.leadMinutes, now),
    }));
}

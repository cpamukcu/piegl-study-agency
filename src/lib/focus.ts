// The Focus dial: durations, dial geometry and the session state machine.
// Pure functions only; the component and the saved session live elsewhere.
import type { TaskType } from "@/db/tasks";

export const FOCUS_MIN = 5;
export const FOCUS_MAX = 120;
export const FOCUS_STEP = 5;
export const FOCUS_PRESETS = [25, 45, 60, 90] as const;
export const DEFAULT_MINUTES = 45;

export const FOCUS_MODES = ["Review", "Prepare", "Practice", "Deep work"] as const;
export type FocusMode = (typeof FOCUS_MODES)[number];

// The dial is a 270° arc with the gap at the bottom. Angles are degrees
// clockwise from 12 o'clock: the arc runs from -135° to +135°.
export const ARC_START = -135;
export const ARC_SWEEP = 270;

export function clampMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_MINUTES;
  const stepped = Math.round(minutes / FOCUS_STEP) * FOCUS_STEP;
  return Math.min(FOCUS_MAX, Math.max(FOCUS_MIN, stepped));
}

// Share of the arc for a duration: 0 at the start, 1 at FOCUS_MAX.
export function minutesToFraction(minutes: number): number {
  return Math.min(1, Math.max(0, minutes / FOCUS_MAX));
}

export function fractionToAngle(fraction: number): number {
  return ARC_START + fraction * ARC_SWEEP;
}

export function pointOnCircle(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

// An SVG path for the arc from one angle to another, drawn clockwise.
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const a = pointOnCircle(cx, cy, r, from);
  const b = pointOnCircle(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

// The duration under a pointer at (dx, dy) from the dial centre. Inside the gap
// at the bottom it sticks to the nearer end; while dragging it never jumps
// straight from one end of the arc to the other.
export function pointerToMinutes(dx: number, dy: number, previous?: number): number {
  let angle = (Math.atan2(dx, -dy) * 180) / Math.PI; // -180..180, clockwise from top
  if (angle > -ARC_START) angle = -ARC_START;
  if (angle < ARC_START) angle = ARC_START;
  const minutes = clampMinutes(((angle - ARC_START) / ARC_SWEEP) * FOCUS_MAX);
  if (previous !== undefined) {
    const jump = Math.abs(minutes - previous);
    if (jump > FOCUS_MAX / 2) return previous >= FOCUS_MAX / 2 ? FOCUS_MAX : FOCUS_MIN;
  }
  return minutes;
}

// The minutes to suggest for a task: its estimate, else the default.
export function suggestMinutes(estMinutes: number | null): number {
  return estMinutes ? clampMinutes(estMinutes) : DEFAULT_MINUTES;
}

export function modeForTask(type: TaskType | null): FocusMode {
  switch (type) {
    case "prep":
      return "Prepare";
    case "reading":
      return "Review";
    case "exam":
    case "presentation":
      return "Practice";
    default:
      return "Deep work";
  }
}

// "32:18", or "1:05:00" for an hour or more.
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Words for a screen reader: "32 minutes 18 seconds".
export function spokenCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const parts = [];
  if (m) parts.push(`${m} ${m === 1 ? "minute" : "minutes"}`);
  if (s || !m) parts.push(`${s} ${s === 1 ? "second" : "seconds"}`);
  return parts.join(" ");
}

export type FocusStatus = "idle" | "running" | "paused" | "done";

export type FocusSession = {
  status: FocusStatus;
  minutes: number; // chosen duration
  mode: FocusMode;
  taskId: string | null;
  endsAt: number | null; // while running
  remainingMs: number | null; // while paused
};

export function remainingMs(session: FocusSession, now: number): number {
  if (session.status === "running" && session.endsAt !== null) return Math.max(0, session.endsAt - now);
  if (session.status === "paused" && session.remainingMs !== null) return session.remainingMs;
  if (session.status === "done") return 0;
  return session.minutes * 60_000;
}

// A running session whose time is up counts as done.
export function effectiveStatus(session: FocusSession, now: number): FocusStatus {
  return session.status === "running" && remainingMs(session, now) <= 0 ? "done" : session.status;
}

export function start(session: FocusSession, now: number): FocusSession {
  return { ...session, status: "running", endsAt: now + session.minutes * 60_000, remainingMs: null };
}

export function pause(session: FocusSession, now: number): FocusSession {
  return { ...session, status: "paused", remainingMs: remainingMs(session, now), endsAt: null };
}

export function resume(session: FocusSession, now: number): FocusSession {
  return { ...session, status: "running", endsAt: now + (session.remainingMs ?? session.minutes * 60_000), remainingMs: null };
}

export function finish(session: FocusSession): FocusSession {
  return { ...session, status: "done", endsAt: null, remainingMs: null };
}

export function reset(session: FocusSession): FocusSession {
  return { ...session, status: "idle", endsAt: null, remainingMs: null };
}

// Reads a saved session, refusing anything malformed.
export function parseSession(raw: string | null): FocusSession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<FocusSession>;
    if (!v || typeof v !== "object") return null;
    if (!["idle", "running", "paused", "done"].includes(v.status as string)) return null;
    if (typeof v.minutes !== "number" || !FOCUS_MODES.includes(v.mode as FocusMode)) return null;
    if (v.status === "running" && typeof v.endsAt !== "number") return null;
    if (v.status === "paused" && typeof v.remainingMs !== "number") return null;
    return {
      status: v.status as FocusStatus,
      minutes: clampMinutes(v.minutes),
      mode: v.mode as FocusMode,
      taskId: typeof v.taskId === "string" ? v.taskId : null,
      endsAt: typeof v.endsAt === "number" ? v.endsAt : null,
      remainingMs: typeof v.remainingMs === "number" ? v.remainingMs : null,
    };
  } catch {
    return null;
  }
}

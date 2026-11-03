"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { setTaskStatusAction } from "@/app/actions";
import { Icon, type IconName } from "@/components/icons";
import { BUTTON_GHOST, BUTTON_PRIMARY, CARD_LG } from "@/components/ui";
import type { TaskType } from "@/db/tasks";
import type { Progress } from "@/lib/day-plan";
import {
  FOCUS_MAX,
  FOCUS_MIN,
  FOCUS_MODES,
  FOCUS_PRESETS,
  FOCUS_STEP,
  arcPath,
  clampMinutes,
  effectiveStatus,
  finish,
  formatCountdown,
  fractionToAngle,
  minutesToFraction,
  modeForTask,
  pause,
  pointOnCircle,
  pointerToMinutes,
  remainingMs,
  reset,
  resume,
  spokenCountdown,
  start,
  suggestMinutes,
  type FocusMode,
  type FocusSession,
} from "@/lib/focus";
import { getFocusServerSnapshot, getFocusSnapshot, saveFocus, subscribeFocus } from "@/lib/focus-store";
import { formatClock, shanghaiParts } from "@/lib/time";

export type FocusTask = {
  id: string;
  title: string;
  type: TaskType;
  courseTitle: string | null;
  courseColor: string | null;
  estMinutes: number | null;
};

type FocusDialProps = { tasks: FocusTask[]; now: number; progress: Progress | null };

const MODE_ICON: Record<FocusMode, IconName> = { Review: "book", Prepare: "prepare", Practice: "practice", "Deep work": "focus" };

// Dial geometry, in SVG units.
const SIZE = 300;
const C = SIZE / 2;
const R = 124;
const STROKE = 16;
const END = fractionToAngle(1);
const TRACK = arcPath(C, C, R, fractionToAngle(0), END);

function endClock(ms: number): string {
  const p = shanghaiParts(ms);
  return formatClock(p.hour * 60 + p.minute);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// A small tactile pulse: a quick scale on the pressed control, and a real tap where the device supports it.
function pulse(el: HTMLElement | null) {
  if (!el) return;
  if (!prefersReducedMotion() && typeof el.animate === "function") {
    el.animate([{ transform: "scale(1)" }, { transform: "scale(0.9)" }, { transform: "scale(1)" }], { duration: 220, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" });
  }
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(8);
}

function Ticks() {
  const marks = [];
  for (let m = 0; m <= FOCUS_MAX; m += FOCUS_STEP) {
    const angle = fractionToAngle(m / FOCUS_MAX);
    const major = m % 30 === 0;
    const a = pointOnCircle(C, C, R - 22, angle);
    const b = pointOnCircle(C, C, R - (major ? 31 : 25), angle);
    marks.push(
      major ? (
        <line key={m} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d9d3f2" strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        <circle key={m} cx={a.x} cy={a.y} r="1.6" fill="#e2ddf4" />
      ),
    );
  }
  return <g aria-hidden="true">{marks}</g>;
}

export function FocusDial({ tasks, now: initialNow, progress }: FocusDialProps) {
  const saved = useSyncExternalStore(subscribeFocus, getFocusSnapshot, getFocusServerSnapshot);
  const top = tasks[0] ?? null;
  const defaults: FocusSession = {
    status: "idle",
    minutes: suggestMinutes(top?.estMinutes ?? null),
    mode: modeForTask(top?.type ?? null),
    taskId: top?.id ?? null,
    endsAt: null,
    remainingMs: null,
  };
  const session = saved ?? defaults;
  const task = tasks.find((t) => t.id === session.taskId) ?? (saved && session.taskId === null ? null : top);

  const [now, setNow] = useState(initialNow);
  const status = effectiveStatus(session, now);
  const left = remainingMs(session, now);

  const [shown, setShown] = useState(session.minutes);
  const shownRef = useRef(session.minutes);
  const jumpRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [knobFocused, setKnobFocused] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState(false);
  const [announce, setAnnounce] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const ids = useId();

  const save = (next: FocusSession) => saveFocus(next);
  const setMinutes = (minutes: number, instant = false) => {
    jumpRef.current = instant;
    save({ ...session, minutes: clampMinutes(minutes) });
  };

  // Spring the arc towards the chosen duration; jump while dragging or with reduced motion.
  const target = session.minutes;
  useEffect(() => {
    let frame = 0;
    let value = shownRef.current;
    let velocity = 0;
    let last = 0;
    const settle = () => {
      shownRef.current = target;
      setShown(target);
    };
    if (typeof requestAnimationFrame !== "function") {
      const t = setTimeout(settle, 0);
      return () => clearTimeout(t);
    }
    const step = (time: number) => {
      if (jumpRef.current || prefersReducedMotion()) {
        jumpRef.current = false;
        settle();
        return;
      }
      const dt = last ? Math.min(0.032, (time - last) / 1000) : 1 / 60;
      last = time;
      velocity += (180 * (target - value) - 24 * velocity) * dt;
      value += velocity * dt;
      if (Math.abs(target - value) < 0.05 && Math.abs(velocity) < 0.05) {
        settle();
        return;
      }
      shownRef.current = value;
      setShown(value);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  // Tick while a session runs, and finish it when the time is up.
  useEffect(() => {
    if (session.status !== "running") return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (session.endsAt !== null && t >= session.endsAt) {
        saveFocus(finish(session));
        setAnnounce("Focus session complete.");
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate([12, 60, 12]);
      }
    }, 250);
    return () => clearInterval(id);
  }, [session]);

  // Show the countdown in the browser tab while a session runs.
  useEffect(() => {
    if (status !== "running") return;
    const original = document.title;
    document.title = `${formatCountdown(left)} · Focus`;
    return () => {
      document.title = original;
    };
  }, [status, left]);

  // Close the task picker on Escape or a click outside it.
  useEffect(() => {
    if (!picking) return;
    const onDown = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node) && !pickerButtonRef.current?.contains(e.target as Node)) setPicking(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPicking(false);
        pickerButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [picking]);

  const idle = status === "idle";
  const minutesAt = (e: React.PointerEvent, previous?: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return session.minutes;
    const scale = SIZE / box.width;
    return pointerToMinutes((e.clientX - box.left) * scale - C, (e.clientY - box.top) * scale - C, previous);
  };
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!idle) return;
    const box = e.currentTarget.getBoundingClientRect();
    const scale = SIZE / box.width;
    const dist = Math.hypot((e.clientX - box.left) * scale - C, (e.clientY - box.top) * scale - C);
    if (dist < R - 40 || dist > R + 30) return; // only the ring itself
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    setMinutes(minutesAt(e), true);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const next = minutesAt(e, session.minutes);
    if (next !== session.minutes) setMinutes(next, true);
  };
  const endDrag = () => setDragging(false);
  const onKnobKey = (e: React.KeyboardEvent) => {
    if (!idle) return;
    const delta: Record<string, number> = { ArrowRight: FOCUS_STEP, ArrowUp: FOCUS_STEP, ArrowLeft: -FOCUS_STEP, ArrowDown: -FOCUS_STEP, PageUp: 15, PageDown: -15 };
    if (e.key in delta) setMinutes(session.minutes + delta[e.key]);
    else if (e.key === "Home") setMinutes(FOCUS_MIN);
    else if (e.key === "End") setMinutes(FOCUS_MAX);
    else return;
    e.preventDefault();
  };

  const commitDraft = () => {
    const value = Number(draft);
    if (draft.trim() && Number.isFinite(value)) setMinutes(value);
    setEditing(false);
  };
  const openEditor = () => {
    if (!idle) return;
    setDraft(String(session.minutes));
    setEditing(true);
  };

  const chooseTask = (t: FocusTask | null) => {
    save({
      ...session,
      taskId: t?.id ?? null,
      mode: t ? modeForTask(t.type) : session.mode,
      minutes: t?.estMinutes ? suggestMinutes(t.estMinutes) : session.minutes,
    });
    setPicking(false);
    pickerButtonRef.current?.focus();
  };

  const onPrimary = (e: React.MouseEvent<HTMLButtonElement>) => {
    pulse(e.currentTarget);
    const t = Date.now();
    setNow(t);
    if (status === "idle") {
      save(start(session, t));
      setAnnounce(`Focus session started: ${session.minutes} minutes.`);
    } else if (status === "running") {
      save(pause(session, t));
      setAnnounce("Session paused.");
    } else if (status === "paused") {
      save(resume(session, t));
      setAnnounce("Session resumed.");
    } else {
      const next = tasks.find((x) => x.id !== task?.id) ?? null;
      save({ ...reset(session), taskId: next?.id ?? null, mode: next ? modeForTask(next.type) : session.mode, minutes: suggestMinutes(next?.estMinutes ?? null) });
      setAnnounce("Ready to plan your next session.");
      setPicking(true);
    }
  };
  const onEnd = () => {
    save(reset(session));
    setAnnounce("Session ended.");
  };

  // What the ring shows: the chosen duration, the time left, or a full ring when done.
  const fraction =
    status === "idle" ? minutesToFraction(shown) : status === "done" ? 1 : session.minutes ? left / (session.minutes * 60_000) : 0;
  const knob = pointOnCircle(C, C, R, fractionToAngle(minutesToFraction(shown)));
  const done = status === "done";
  const primaryLabel = { idle: `Start ${session.minutes} min focus`, running: "Pause session", paused: "Resume session", done: "Plan what’s next" }[status];
  const primaryIcon: IconName = { idle: "focus", running: "clock", paused: "arrow-right", done: "sparkle" }[status] as IconName;
  const taskLine = task ? `${tasks[0]?.id === task.id ? "Best for" : "For"} ${task.title}` : "Free focus, no task chosen";
  const helper = {
    idle: "Drag the dial or pick a time, then start.",
    running: session.endsAt ? `Ends at ${endClock(session.endsAt)}. One thing at a time.` : "",
    paused: "Paused. Pick up where you left off.",
    done: "Nice work. Take a short break, then plan what’s next.",
  }[status];

  return (
    <section id="focus-for-now" aria-labelledby={`${ids}-heading`} className={`${CARD_LG} relative scroll-mt-8 overflow-hidden`}>
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-56 w-72 rounded-full bg-wash blur-2xl" />
      <div className="relative flex items-center justify-between gap-3">
        <h2 id={`${ids}-heading`} className="text-lg">
          Focus for now
        </h2>
        <button
          type="button"
          onClick={openEditor}
          disabled={!idle}
          aria-label="Set a custom duration"
          title="Set a custom duration"
          className="inline-flex size-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-lavender-50 hover:text-accent disabled:opacity-40"
        >
          <Icon name="more" />
        </button>
      </div>

      {/* What this session is for: tap to choose another task. */}
      <div className="relative mt-3">
        <button
          ref={pickerButtonRef}
          type="button"
          onClick={() => setPicking((p) => !p)}
          disabled={!idle || tasks.length === 0}
          aria-expanded={picking}
          aria-controls={`${ids}-picker`}
          aria-label={`Focus task: ${task ? task.title : "none"}. Choose a different task`}
          className="flex w-full items-center gap-3 rounded-[18px] bg-surface-soft px-4 py-3 text-left ring-1 ring-line transition hover:ring-lavender/40 disabled:cursor-default disabled:hover:ring-line"
        >
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl"
            style={task?.courseColor ? { backgroundColor: `color-mix(in srgb, ${task.courseColor} 14%, white)`, color: task.courseColor } : undefined}
          >
            <Icon name={MODE_ICON[session.mode]} className={`size-[18px] ${task?.courseColor ? "" : "text-lavender"}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted">
              {task?.courseColor && <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: task.courseColor }} />}
              <span className="truncate">{task?.courseTitle ?? (task ? "No course" : "Any subject")}</span>
              {task?.estMinutes ? <span className="shrink-0">· about {task.estMinutes} min</span> : null}
            </span>
            <span className="block truncate text-[15px] font-semibold text-ink">{task ? task.title : "Free focus"}</span>
          </span>
          {idle && tasks.length > 0 && <Icon name="chevron-down" className={`size-4 text-faint transition-transform duration-200 ${picking ? "rotate-180" : ""}`} />}
        </button>
        {picking && (
          <div
            ref={pickerRef}
            id={`${ids}-picker`}
            role="group"
            aria-label="Choose a task to focus on"
            className="absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-[20px] bg-white p-2 shadow-lift ring-1 ring-line"
          >
            {tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => chooseTask(t)}
                aria-pressed={t.id === task?.id}
                className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left ${t.id === task?.id ? "bg-pill" : "hover:bg-tint"}`}
              >
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.courseColor ?? "#c5a4f6" }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{t.title}</span>
                  <span className="block truncate text-[12px] text-ink-muted">
                    {[t.courseTitle, t.estMinutes ? `about ${t.estMinutes} min` : null, modeForTask(t.type)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {t.id === task?.id && <Icon name="check" className="size-4 text-accent" />}
              </button>
            ))}
            <button
              type="button"
              onClick={() => chooseTask(null)}
              aria-pressed={task === null}
              className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-sm font-semibold text-ink ${task === null ? "bg-pill" : "hover:bg-tint"}`}
            >
              <Icon name="sparkle" className="size-4 text-lavender" />
              Free focus, no task
            </button>
          </div>
        )}
      </div>

      {/* The dial. */}
      <div className="relative mx-auto mt-5 aspect-square w-full max-w-[300px]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={`absolute inset-0 h-full w-full select-none ${idle ? "cursor-pointer touch-none" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-hidden={!idle}
        >
          <defs>
            <linearGradient id={`${ids}-arc`} gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="270" y2="0">
              <stop offset="0" stopColor="#ef70b7" />
              <stop offset="0.5" stopColor="#b98af3" />
              <stop offset="1" stopColor="#6978e8" />
            </linearGradient>
            <linearGradient id={`${ids}-done`} gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="270" y2="0">
              <stop offset="0" stopColor="#68bca8" />
              <stop offset="1" stopColor="#c5a4f6" />
            </linearGradient>
            <filter id={`${ids}-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#9a75ee" floodOpacity="0.28" />
            </filter>
          </defs>
          <path d={TRACK} fill="none" stroke="#f0eef8" strokeWidth={STROKE} strokeLinecap="round" />
          <Ticks />
          {fraction > 0.001 && (
            <path
              d={TRACK}
              fill="none"
              stroke={`url(#${ids}-${done ? "done" : "arc"})`}
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={1000}
              strokeDasharray={`${Math.round(fraction * 1000)} 1000`}
              className={status === "running" ? "transition-[stroke-dasharray] duration-300 ease-linear" : ""}
            />
          )}
          {idle && (
            <g
              role="slider"
              tabIndex={0}
              aria-label="Focus duration"
              aria-valuemin={FOCUS_MIN}
              aria-valuemax={FOCUS_MAX}
              aria-valuenow={session.minutes}
              aria-valuetext={`${session.minutes} minutes`}
              onKeyDown={onKnobKey}
              onFocus={() => setKnobFocused(true)}
              onBlur={() => setKnobFocused(false)}
              className="cursor-grab outline-none active:cursor-grabbing"
            >
              <circle cx={knob.x} cy={knob.y} r="26" fill="transparent" />
              {knobFocused && <circle cx={knob.x} cy={knob.y} r="21" fill="none" stroke="#6a4fd6" strokeWidth="2" strokeDasharray="3 3" />}
              <circle
                cx={knob.x}
                cy={knob.y}
                r={dragging ? 15 : 13}
                fill="white"
                stroke={`url(#${ids}-arc)`}
                strokeWidth="4"
                filter={`url(#${ids}-glow)`}
                className="transition-[r] duration-150"
              />
            </g>
          )}
        </svg>

        {/* Centre. Pointer events pass through to the dial except on its own buttons. */}
        <div className="pointer-events-none absolute inset-[22%] flex flex-col items-center justify-center text-center">
          {done ? (
            <>
              <span className="flex size-14 items-center justify-center rounded-full bg-mint-50 text-mint-ink">
                <Icon name="check" className="size-7" strokeWidth={2.4} />
              </span>
              <p className="mt-3 font-display text-lg font-bold leading-tight text-ink">Focus session complete</p>
              <p className="mt-1 text-[13px] font-medium text-ink-muted">
                {session.minutes} min · {session.mode}
              </p>
            </>
          ) : idle ? (
            <>
              <Icon name={MODE_ICON[session.mode]} className="size-5 text-lavender" />
              {editing ? (
                <form
                  noValidate
                  className="pointer-events-auto mt-1 flex items-baseline gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitDraft();
                  }}
                >
                  <label htmlFor={`${ids}-custom`} className="sr-only">
                    Focus duration in minutes
                  </label>
                  <input
                    id={`${ids}-custom`}
                    type="number"
                    inputMode="numeric"
                    min={FOCUS_MIN}
                    max={FOCUS_MAX}
                    step={FOCUS_STEP}
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitDraft}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditing(false);
                    }}
                    className="w-[3.2ch] rounded-lg bg-lavender-50 text-center font-display text-[44px] font-bold leading-none text-ink outline-none ring-2 ring-lavender/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-lg font-semibold text-ink-muted">min</span>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={openEditor}
                  aria-label={`Focus duration ${session.minutes} minutes. Type a different time`}
                  className="pointer-events-auto mt-1 rounded-2xl px-2 font-display leading-none text-ink transition hover:bg-lavender-50/70"
                >
                  <span className="text-[52px] font-bold tabular-nums tracking-tight">{session.minutes}</span>
                  <span className="ml-1 text-lg font-semibold text-ink-muted">min</span>
                </button>
              )}
              <p className="mt-1.5 text-sm font-semibold text-body">Focus session</p>
              <p className="mt-1 line-clamp-2 max-w-[11rem] text-[12px] font-medium leading-snug text-ink-muted">{taskLine}</p>
            </>
          ) : (
            <>
              <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">{status === "paused" ? "Paused" : "Remaining"}</span>
              <p className="mt-1 font-display text-[46px] font-bold leading-none tabular-nums tracking-tight text-ink" aria-label={`${spokenCountdown(left)} remaining`}>
                {formatCountdown(left)}
              </p>
              <p className="mt-1.5 text-[13px] font-medium text-ink-muted">
                of {session.minutes} min · {session.mode}
              </p>
              <button
                type="button"
                onClick={onPrimary}
                aria-label={status === "running" ? "Pause session" : "Resume session"}
                title={status === "running" ? "Pause" : "Resume"}
                className="pointer-events-auto mt-3 inline-flex size-10 items-center justify-center rounded-full bg-lavender-50 text-accent transition hover:bg-[#ebe4fd] active:scale-90"
              >
                {status === "running" ? (
                  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                    <rect x="6" y="5" width="4" height="14" rx="1.5" />
                    <rect x="14" y="5" width="4" height="14" rx="1.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                    <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <p className="relative -mt-10 px-8 text-center text-[13px] font-medium text-ink-muted sm:-mt-12">{helper}</p>
      {progress && progress.total > 0 && (
        <p className="relative mt-1 text-center text-[12px] font-semibold text-faint">
          {progress.done} of {progress.total} done {progress.scope}
        </p>
      )}

      {/* Presets: the dial never relies on dragging alone. */}
      <div role="group" aria-label="Focus duration presets" className="relative mt-5 grid grid-cols-4 gap-2">
        {FOCUS_PRESETS.map((m) => {
          const selected = session.minutes === m;
          return (
            <button
              key={m}
              type="button"
              disabled={!idle}
              aria-pressed={selected}
              aria-label={`Set focus duration to ${m} minutes`}
              onClick={(e) => {
                pulse(e.currentTarget);
                setMinutes(m);
              }}
              className={`rounded-[14px] py-2.5 text-sm font-semibold transition duration-200 disabled:opacity-50 ${
                selected ? "bg-pill text-accent ring-1 ring-lavender/40" : "bg-tint text-ink ring-1 ring-line hover:bg-lavender-50"
              }`}
            >
              {m} min
            </button>
          );
        })}
      </div>

      <div className="relative mt-4 flex flex-col gap-2">
        <button type="button" onClick={onPrimary} className={`${BUTTON_PRIMARY} w-full rounded-[18px] py-3.5 text-[15px]`}>
          <Icon name={primaryIcon} className="size-[18px]" />
          {primaryLabel}
        </button>
        {status === "paused" && (
          <button type="button" onClick={onEnd} className={`${BUTTON_GHOST} self-center`}>
            End session
          </button>
        )}
        {done && task && (
          <form action={setTaskStatusAction} className="self-center">
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="status" value="done" />
            <button type="submit" className={BUTTON_GHOST}>
              <Icon name="check" className="size-4" />
              Mark “{task.title}” done
            </button>
          </form>
        )}
      </div>

      {/* Study mode. */}
      <div role="group" aria-label="Study mode" className="relative mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
        {FOCUS_MODES.map((mode) => {
          const selected = session.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              disabled={!idle}
              aria-pressed={selected}
              onClick={(e) => {
                pulse(e.currentTarget);
                save({ ...session, mode });
              }}
              className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition duration-200 disabled:opacity-50 ${
                selected ? "bg-action text-white shadow-card" : "bg-surface text-ink ring-1 ring-line hover:bg-tint"
              }`}
            >
              <Icon name={MODE_ICON[mode]} className="size-4" />
              {mode}
            </button>
          );
        })}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </section>
  );
}

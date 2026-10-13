import { describe, expect, it } from "vitest";
import {
  DEFAULT_MINUTES,
  FOCUS_MAX,
  FOCUS_MIN,
  arcPath,
  clampMinutes,
  effectiveStatus,
  finish,
  formatCountdown,
  fractionToAngle,
  minutesToFraction,
  modeForTask,
  parseSession,
  pause,
  pointOnCircle,
  pointerToMinutes,
  remainingMs,
  reset,
  resume,
  spokenCountdown,
  start,
  suggestMinutes,
  type FocusSession,
} from "@/lib/focus";

const MIN = 60_000;
const idle: FocusSession = { status: "idle", minutes: 45, mode: "Prepare", taskId: "t1", endsAt: null, remainingMs: null };

describe("durations", () => {
  it("clamps to 5-minute steps between the limits", () => {
    expect(clampMinutes(7)).toBe(5);
    expect(clampMinutes(43)).toBe(45);
    expect(clampMinutes(1)).toBe(FOCUS_MIN);
    expect(clampMinutes(500)).toBe(FOCUS_MAX);
    expect(clampMinutes(Number.NaN)).toBe(DEFAULT_MINUTES);
  });

  it("suggests a task's estimate, else the default", () => {
    expect(suggestMinutes(30)).toBe(30);
    expect(suggestMinutes(200)).toBe(FOCUS_MAX);
    expect(suggestMinutes(null)).toBe(DEFAULT_MINUTES);
  });

  it("picks a study mode from the task type", () => {
    expect(modeForTask("prep")).toBe("Prepare");
    expect(modeForTask("reading")).toBe("Review");
    expect(modeForTask("exam")).toBe("Practice");
    expect(modeForTask("assignment")).toBe("Deep work");
    expect(modeForTask(null)).toBe("Deep work");
  });
});

describe("dial geometry", () => {
  it("maps durations onto a 270° arc with the gap at the bottom", () => {
    expect(fractionToAngle(minutesToFraction(0))).toBe(-135);
    expect(fractionToAngle(minutesToFraction(60))).toBe(0);
    expect(fractionToAngle(minutesToFraction(FOCUS_MAX))).toBe(135);
    const top = pointOnCircle(150, 150, 100, 0);
    expect(top.x).toBeCloseTo(150);
    expect(top.y).toBeCloseTo(50);
    expect(arcPath(150, 150, 100, -135, 135)).toMatch(/^M .* A 100 100 0 1 1 /);
  });

  it("reads a duration from the pointer position", () => {
    expect(pointerToMinutes(0, -100)).toBe(60); // straight up
    expect(pointerToMinutes(100, 0)).toBe(100); // 3 o'clock: 90° of 270° past the middle
    expect(pointerToMinutes(-100, 0)).toBe(20); // 9 o'clock
  });

  it("sticks to the nearer end inside the bottom gap", () => {
    expect(pointerToMinutes(10, 100)).toBe(FOCUS_MAX);
    expect(pointerToMinutes(-10, 100)).toBe(FOCUS_MIN);
  });

  it("never jumps from one end of the arc to the other while dragging", () => {
    expect(pointerToMinutes(-10, 100, FOCUS_MAX)).toBe(FOCUS_MAX);
    expect(pointerToMinutes(10, 100, FOCUS_MIN)).toBe(FOCUS_MIN);
    expect(pointerToMinutes(0, -100, 55)).toBe(60);
  });
});

describe("countdown text", () => {
  it("formats the time left", () => {
    expect(formatCountdown(32 * MIN + 18_000)).toBe("32:18");
    expect(formatCountdown(65 * MIN)).toBe("1:05:00");
    expect(formatCountdown(400)).toBe("0:01");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  it("speaks the time left", () => {
    expect(spokenCountdown(32 * MIN + 18_000)).toBe("32 minutes 18 seconds");
    expect(spokenCountdown(MIN)).toBe("1 minute");
    expect(spokenCountdown(0)).toBe("0 seconds");
  });
});

describe("session", () => {
  it("starts, pauses, resumes and finishes", () => {
    const running = start(idle, 0);
    expect(running).toMatchObject({ status: "running", endsAt: 45 * MIN });
    expect(remainingMs(running, 10 * MIN)).toBe(35 * MIN);

    const paused = pause(running, 10 * MIN);
    expect(paused).toMatchObject({ status: "paused", remainingMs: 35 * MIN, endsAt: null });
    expect(remainingMs(paused, 99 * MIN)).toBe(35 * MIN);

    const resumed = resume(paused, 20 * MIN);
    expect(resumed.endsAt).toBe(55 * MIN);
    expect(effectiveStatus(resumed, 54 * MIN)).toBe("running");
    expect(effectiveStatus(resumed, 55 * MIN)).toBe("done");

    expect(finish(resumed).status).toBe("done");
    expect(remainingMs(finish(resumed), 0)).toBe(0);
    expect(reset(resumed)).toMatchObject({ status: "idle", endsAt: null, remainingMs: null, minutes: 45 });
  });

  it("shows the full duration before it starts", () => {
    expect(remainingMs(idle, 123)).toBe(45 * MIN);
  });
});

describe("parseSession", () => {
  it("reads a saved session", () => {
    expect(parseSession(JSON.stringify(start(idle, 0)))).toEqual(start(idle, 0));
  });

  it("refuses anything malformed", () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession("not json")).toBeNull();
    expect(parseSession(JSON.stringify({ ...idle, status: "flying" }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...idle, mode: "Gaming" }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...idle, status: "running" }))).toBeNull(); // no end time
  });

  it("clamps a saved duration", () => {
    expect(parseSession(JSON.stringify({ ...idle, minutes: 999 }))?.minutes).toBe(FOCUS_MAX);
  });
});

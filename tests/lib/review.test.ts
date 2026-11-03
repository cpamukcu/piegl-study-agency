import { describe, expect, it } from "vitest";
import { checkPlan, latestDay, suggestPlan, summarizeWeek, weekLabel } from "@/lib/review";
import { DAY_MS, shanghaiToMs } from "@/lib/time";
import { makeTask } from "../helpers/task";

// Monday 2 November 2026 (Shanghai); the plan is for the week of Monday 9 November.
const THIS_WEEK = shanghaiToMs("2026-11-02");
const NEXT_WEEK = shanghaiToMs("2026-11-09");
const at = (date: string, hhmm: string) => shanghaiToMs(date, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)));

describe("latestDay", () => {
  it("is the due day, or the day before for morning deadlines, within the week", () => {
    expect(latestDay({ dueAt: at("2026-11-11", "23:59") }, NEXT_WEEK)).toBe(2);
    expect(latestDay({ dueAt: at("2026-11-11", "09:00") }, NEXT_WEEK)).toBe(1);
    expect(latestDay({ dueAt: at("2026-11-09", "08:00") }, NEXT_WEEK)).toBe(0);
    expect(latestDay({ dueAt: at("2026-11-05", "12:00") }, NEXT_WEEK)).toBe(0);
    expect(latestDay({ dueAt: at("2026-11-30", "12:00") }, NEXT_WEEK)).toBe(6);
    expect(latestDay({ dueAt: null }, NEXT_WEEK)).toBe(6);
  });
});

describe("suggestPlan", () => {
  it("never plans a task after it is due, and spreads work over days with room", () => {
    const tasks = [
      makeTask({ id: "essay", title: "Essay", dueAt: at("2026-11-11", "23:59"), estMinutes: 150 }),
      makeTask({ id: "quiz", title: "Quiz prep", dueAt: at("2026-11-10", "10:00"), estMinutes: 120 }),
      makeTask({ id: "late", title: "Late reading", dueAt: at("2026-11-04", "12:00"), estMinutes: null }),
      makeTask({ id: "later", title: "Due in December", dueAt: at("2026-12-01", "12:00") }),
      makeTask({ id: "done", title: "Done", dueAt: at("2026-11-10", "12:00"), status: "done" }),
      makeTask({ id: "prep", title: "Prep", type: "prep", dueAt: at("2026-11-10", "12:00") }),
      makeTask({ id: "idea", title: "Important idea", dueAt: null, importance: 3, estMinutes: 30 }),
    ];
    const plan = suggestPlan(tasks, NEXT_WEEK);
    expect(plan.map((p) => [p.taskId, p.day, p.overCapacity])).toEqual([
      ["late", 0, false],
      ["quiz", 0, false],
      ["essay", 1, false],
      ["idea", 1, false],
    ]);
    expect(Object.keys(checkPlan(plan, tasks, NEXT_WEEK))).toEqual([]);
  });

  it("flags a deadline that does not fit instead of moving it past the deadline", () => {
    const tasks = [makeTask({ id: "big", title: "Big", dueAt: at("2026-11-09", "23:00"), estMinutes: 400 })];
    expect(suggestPlan(tasks, NEXT_WEEK)).toMatchObject([{ taskId: "big", day: 0, overCapacity: true }]);
  });
});

describe("checkPlan", () => {
  it("refuses a day after the deadline and unknown tasks", () => {
    const tasks = [makeTask({ id: "essay", title: "Essay", dueAt: at("2026-11-11", "23:59") })];
    expect(checkPlan([{ taskId: "essay", day: 3 }], tasks, NEXT_WEEK)).toEqual({ essay: "Essay is due before then. Plan it earlier." });
    expect(checkPlan([{ taskId: "essay", day: 2 }], tasks, NEXT_WEEK)).toEqual({});
    expect(checkPlan([{ taskId: "gone", day: 0 }], tasks, NEXT_WEEK)).toEqual({ gone: "This task no longer exists." });
    expect(checkPlan([{ taskId: "essay", day: Number.NaN }], tasks, NEXT_WEEK)).toEqual({ essay: "Pick a day." });
  });
});

describe("summarizeWeek", () => {
  it("collects finished, postponed and overdue work for the week", () => {
    const now = THIS_WEEK + 4 * DAY_MS;
    const summary = summarizeWeek(
      [
        makeTask({ id: "a", status: "done", completedAt: THIS_WEEK + DAY_MS }),
        makeTask({ id: "b", status: "done", completedAt: THIS_WEEK - DAY_MS }),
        makeTask({ id: "c", status: "postponed", updatedAt: THIS_WEEK + 2 * DAY_MS }),
        makeTask({ id: "d", dueAt: THIS_WEEK + DAY_MS }),
        makeTask({ id: "e", dueAt: NEXT_WEEK + DAY_MS }),
      ],
      THIS_WEEK,
      now,
    );
    expect(summary.done.map((t) => t.id)).toEqual(["a"]);
    expect(summary.postponed.map((t) => t.id)).toEqual(["c"]);
    expect(summary.overdue.map((t) => t.id)).toEqual(["d"]);
    expect(summary.dueNextWeek.map((t) => t.id)).toEqual(["e"]);
    expect(weekLabel(THIS_WEEK)).toBe("2–8 Nov");
    expect(weekLabel(shanghaiToMs("2026-11-30"))).toBe("30 Nov – 6 Dec");
  });
});

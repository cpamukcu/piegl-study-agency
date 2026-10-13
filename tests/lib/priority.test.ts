import { describe, expect, it } from "vitest";
import { rankTasks, scoreTask } from "@/lib/priority";
import { DAY_MS, HOUR_MS } from "@/lib/time";
import { makeTask } from "../helpers/task";

const NOW = Date.parse("2026-10-12T04:00:00Z"); // Mon 12:00 Shanghai
const TONIGHT = Date.parse("2026-10-12T15:59:00Z"); // Mon 23:59 Shanghai

describe("scoreTask", () => {
  it("does not score finished tasks", () => {
    expect(scoreTask(makeTask({ status: "done", dueAt: TONIGHT }), NOW)).toBeNull();
  });

  it("explains each score in plain words", () => {
    expect(scoreTask(makeTask({ dueAt: NOW - 2 * DAY_MS }), NOW)?.reasons).toEqual(["Overdue by 2 days"]);
    expect(scoreTask(makeTask({ dueAt: TONIGHT, estMinutes: 180, importance: 3 }), NOW)?.reasons).toEqual([
      "Due today 23:59",
      "Needs about 3 hours",
      "Marked important",
    ]);
    expect(scoreTask(makeTask({}), NOW)?.reasons).toEqual(["No deadline"]);
  });

  it("only mentions effort when the deadline is close", () => {
    expect(scoreTask(makeTask({ dueAt: NOW + 10 * DAY_MS, estMinutes: 180 }), NOW)?.reasons).toEqual(["Due Thu 22 Oct, 12:00"]);
  });
});

describe("rankTasks", () => {
  it("puts overdue work above everything else", () => {
    const overdue = makeTask({ dueAt: NOW - HOUR_MS, importance: 1 });
    const urgent = makeTask({ dueAt: TONIGHT, importance: 3, estMinutes: 240 });
    expect(rankTasks([urgent, overdue], NOW)[0].task).toBe(overdue);
  });

  it("prefers sooner deadlines at the same importance", () => {
    const soon = makeTask({ dueAt: TONIGHT });
    const later = makeTask({ dueAt: NOW + 7 * DAY_MS });
    expect(rankTasks([later, soon], NOW).map((s) => s.task)).toEqual([soon, later]);
  });

  it("prefers important work at the same deadline", () => {
    const high = makeTask({ dueAt: NOW + 7 * DAY_MS, importance: 3 });
    const low = makeTask({ dueAt: NOW + 7 * DAY_MS, importance: 1 });
    expect(rankTasks([low, high], NOW).map((s) => s.task)).toEqual([high, low]);
  });

  it("ranks undated tasks below tasks due soon", () => {
    const undated = makeTask({ importance: 2 });
    const tomorrow = makeTask({ dueAt: NOW + DAY_MS, importance: 1 });
    expect(rankTasks([undated, tomorrow], NOW).map((s) => s.task)).toEqual([tomorrow, undated]);
  });

  it("leaves done tasks out", () => {
    expect(rankTasks([makeTask({ status: "done" })], NOW)).toEqual([]);
  });
});

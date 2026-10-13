import { describe, expect, it } from "vitest";
import { groupTasks } from "@/lib/deadline-groups";
import { DAY_MS } from "@/lib/time";
import { describeLoad, weeklyWorkload } from "@/lib/workload";
import { makeTask } from "../helpers/task";

const NOW = Date.parse("2026-10-12T04:00:00Z"); // Mon 12 Oct, 12:00 Shanghai
const WEEK_START = Date.parse("2026-10-11T16:00:00Z"); // Mon 12 Oct, 00:00 Shanghai

describe("weeklyWorkload", () => {
  it("adds up estimates per Shanghai week and counts overdue work in this week", () => {
    const weeks = weeklyWorkload(
      [
        makeTask({ dueAt: NOW - 3 * DAY_MS, estMinutes: 60 }),
        makeTask({ dueAt: NOW + DAY_MS, estMinutes: 90 }),
        makeTask({ dueAt: NOW + 2 * DAY_MS }),
        makeTask({ dueAt: NOW + 8 * DAY_MS, estMinutes: 30 }),
        makeTask({ dueAt: NOW + DAY_MS, estMinutes: 500, status: "done" }),
        makeTask({ dueAt: NOW + 60 * DAY_MS, estMinutes: 30 }),
        makeTask({ estMinutes: 30 }),
      ],
      NOW,
      3,
    );
    expect(weeks).toEqual([
      { weekStart: WEEK_START, minutes: 150, tasks: 3, unestimated: 1 },
      { weekStart: WEEK_START + 7 * DAY_MS, minutes: 30, tasks: 1, unestimated: 0 },
      { weekStart: WEEK_START + 14 * DAY_MS, minutes: 0, tasks: 0, unestimated: 0 },
    ]);
  });

  it("describes a week in plain words", () => {
    expect(describeLoad({ weekStart: 0, minutes: 0, tasks: 0, unestimated: 0 })).toBe("No tasks");
    expect(describeLoad({ weekStart: 0, minutes: 210, tasks: 4, unestimated: 1 })).toBe("3 h 30 min · 4 tasks · 1 without estimate");
    expect(describeLoad({ weekStart: 0, minutes: 0, tasks: 1, unestimated: 1 })).toBe("1 task · 1 without estimate");
  });
});

describe("groupTasks", () => {
  it("sorts open tasks into overdue, this week, later and no date", () => {
    const overdue = makeTask({ dueAt: NOW - DAY_MS });
    const sunday = makeTask({ dueAt: Date.parse("2026-10-18T15:00:00Z") });
    const nextMonday = makeTask({ dueAt: Date.parse("2026-10-18T16:30:00Z") });
    const undated = makeTask({});
    const doneToday = makeTask({ status: "done", completedAt: NOW - DAY_MS });
    const doneLongAgo = makeTask({ status: "done", completedAt: NOW - 30 * DAY_MS });
    const groups = groupTasks([nextMonday, undated, sunday, overdue, doneToday, doneLongAgo], NOW);
    expect(groups).toEqual({
      overdue: [overdue],
      thisWeek: [sunday],
      later: [nextMonday],
      noDate: [undated],
      doneRecently: [doneToday],
    });
  });
});

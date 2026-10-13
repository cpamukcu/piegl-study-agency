import { describe, expect, it } from "vitest";
import type { ClassSession } from "@/lib/sessions";
import { DAY_MS, HOUR_MS } from "@/lib/time";
import { buildToday } from "@/lib/today";
import { makeTask } from "../helpers/task";

const NOW = Date.parse("2026-10-12T04:00:00Z");

const session = (overrides: Partial<ClassSession>): ClassSession => ({
  courseId: "c1",
  meetingTimeId: "m1",
  week: 5,
  startsAt: NOW + 20 * HOUR_MS,
  endsAt: NOW + 23 * HOUR_MS,
  room: "Hall 1",
  ...overrides,
});

describe("buildToday", () => {
  it("lists the next three deadlines and counts overdue ones", () => {
    const tasks = [
      makeTask({ title: "late", dueAt: NOW - DAY_MS }),
      makeTask({ title: "d3", dueAt: NOW + 3 * DAY_MS }),
      makeTask({ title: "d1", dueAt: NOW + DAY_MS }),
      makeTask({ title: "d4", dueAt: NOW + 4 * DAY_MS }),
      makeTask({ title: "d2", dueAt: NOW + 2 * DAY_MS }),
      makeTask({ title: "finished", dueAt: NOW + HOUR_MS, status: "done" }),
    ];
    const view = buildToday(tasks, [], NOW);
    expect(view.dueNext.map((t) => t.title)).toEqual(["d1", "d2", "d3"]);
    expect(view.overdueCount).toBe(1);
    expect(view.top?.task.title).toBe("late");
  });

  it("finds the next class and its prep task", () => {
    const next = session({});
    const prep = makeTask({ type: "prep", courseId: "c1", occurrenceKey: String(next.startsAt), dueAt: next.startsAt - 12 * HOUR_MS });
    const view = buildToday([prep], [session({ startsAt: NOW - HOUR_MS }), next], NOW);
    expect(view.nextSession).toBe(next);
    expect(view.prepTask).toBe(prep);
  });

  it("still finds the next class's prep task after it is done", () => {
    const next = session({});
    const prep = makeTask({ type: "prep", courseId: "c1", occurrenceKey: String(next.startsAt), status: "done", completedAt: NOW });
    expect(buildToday([prep], [next], NOW).prepTask).toBe(prep);
  });

  it("handles an empty start", () => {
    expect(buildToday([], [], NOW)).toEqual({ dueNext: [], overdueCount: 0, nextSession: null, prepTask: null, top: null });
  });
});

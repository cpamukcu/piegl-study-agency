import { describe, expect, it } from "vitest";
import type { Task } from "@/db/tasks";
import {
  countdownFraction,
  dateKey,
  dayProgress,
  dayTimeline,
  formatLongDate,
  greeting,
  plannedMinutesToday,
  timeUntil,
  urgencyLabel,
  urgencyOf,
} from "@/lib/day-plan";
import type { ClassSession } from "@/lib/sessions";
import { DAY_MS, HOUR_MS, MINUTE_MS, startOfShanghaiDay } from "@/lib/time";

const NOW = Date.parse("2026-10-12T04:00:00Z"); // Mon 12 Oct, 12:00 Shanghai
const DAY = startOfShanghaiDay(NOW);

function task(over: Partial<Task>): Task {
  return {
    id: over.id ?? "t",
    courseId: null,
    type: "assignment",
    title: "Task",
    dueAt: null,
    estMinutes: null,
    importance: 2,
    status: "todo",
    notes: null,
    source: "manual",
    externalId: null,
    ruleId: null,
    occurrenceKey: null,
    completedAt: null,
    deletedAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

function session(startsAt: number, minutes: number, id = "m"): ClassSession {
  return { courseId: "c", meetingTimeId: id, week: 1, startsAt, endsAt: startsAt + minutes * MINUTE_MS, room: "Hall" };
}

describe("greeting and dates", () => {
  it("greets by Shanghai time of day", () => {
    expect(greeting(Date.parse("2026-10-12T00:30:00Z"))).toBe("Good morning"); // 8:30
    expect(greeting(NOW)).toBe("Good afternoon");
    expect(greeting(Date.parse("2026-10-12T13:00:00Z"))).toBe("Good evening"); // 21:00
    expect(greeting(Date.parse("2026-10-11T19:00:00Z"))).toBe("Good evening"); // 3:00
  });

  it("writes long dates and date keys in Shanghai time", () => {
    expect(formatLongDate(NOW)).toBe("Monday, 12 October");
    expect(dateKey(Date.parse("2026-10-12T17:00:00Z"))).toBe("2026-10-13");
  });
});

describe("timeUntil", () => {
  it("counts down only within the next 12 hours", () => {
    expect(timeUntil(NOW + 42 * MINUTE_MS, NOW)).toBe("In 42 min");
    expect(timeUntil(NOW + 130 * MINUTE_MS, NOW)).toBe("In 2 h 10 min");
    expect(timeUntil(NOW + 12 * HOUR_MS, NOW)).toBeNull();
    expect(timeUntil(NOW - MINUTE_MS, NOW)).toBeNull();
  });
});

describe("urgency", () => {
  it("names how soon a deadline is", () => {
    expect(urgencyLabel(NOW - MINUTE_MS, NOW)).toBe("Overdue");
    expect(urgencyLabel(NOW + 2 * HOUR_MS, NOW)).toBe("Due today");
    expect(urgencyLabel(NOW + DAY_MS, NOW)).toBe("Tomorrow");
    expect(urgencyLabel(NOW + 3 * DAY_MS, NOW)).toBe("In 3 days");
    expect(urgencyLabel(NOW + 8 * DAY_MS, NOW)).toBe("In 1 week");
    expect(urgencyLabel(NOW + 20 * DAY_MS, NOW)).toBe("In 3 weeks");
  });

  it("buckets deadlines for styling", () => {
    expect(urgencyOf(NOW - MINUTE_MS, NOW)).toBe("overdue");
    expect(urgencyOf(NOW + HOUR_MS, NOW)).toBe("today");
    expect(urgencyOf(NOW + DAY_MS, NOW)).toBe("tomorrow");
    expect(urgencyOf(NOW + 4 * DAY_MS, NOW)).toBe("week"); // Fri, same week
    expect(urgencyOf(NOW + 7 * DAY_MS, NOW)).toBe("later");
  });

  it("fills the countdown line over the last week", () => {
    expect(countdownFraction(NOW + 14 * DAY_MS, NOW)).toBe(0);
    expect(countdownFraction(NOW + 3.5 * DAY_MS, NOW)).toBeCloseTo(0.5);
    expect(countdownFraction(NOW - DAY_MS, NOW)).toBe(1);
  });
});

describe("dayProgress", () => {
  it("counts today's tasks when any are due today", () => {
    const tasks = [
      task({ id: "a", dueAt: NOW + HOUR_MS, status: "done" }),
      task({ id: "b", dueAt: NOW + 2 * HOUR_MS }),
      task({ id: "c", dueAt: NOW + 2 * DAY_MS, status: "done" }),
    ];
    expect(dayProgress(tasks, NOW)).toEqual({ done: 1, total: 2, scope: "today" });
  });

  it("falls back to this week on a day with nothing due", () => {
    const tasks = [task({ id: "a", dueAt: NOW + DAY_MS, status: "done" }), task({ id: "b", dueAt: NOW + 2 * DAY_MS }), task({ id: "c", dueAt: NOW + 9 * DAY_MS })];
    expect(dayProgress(tasks, NOW)).toEqual({ done: 1, total: 2, scope: "this week" });
  });
});

describe("plannedMinutesToday", () => {
  it("adds estimates of open work due today or overdue", () => {
    const tasks = [
      task({ id: "a", dueAt: NOW - DAY_MS, estMinutes: 30 }),
      task({ id: "b", dueAt: NOW + HOUR_MS, estMinutes: 45 }),
      task({ id: "c", dueAt: NOW + HOUR_MS, estMinutes: 60, status: "done" }),
      task({ id: "d", dueAt: NOW + DAY_MS, estMinutes: 90 }),
    ];
    expect(plannedMinutesToday(tasks, NOW)).toBe(75);
  });
});

describe("dayTimeline", () => {
  it("merges the day's classes and due tasks in time order, with status", () => {
    const morning = session(DAY + 9 * HOUR_MS, 90, "m1"); // 9:00–10:30, finished
    const afternoon = session(DAY + 14 * HOUR_MS, 60, "m2"); // 14:00, next
    const tomorrow = session(DAY + DAY_MS + 9 * HOUR_MS, 60, "m3");
    const tasks = [
      task({ id: "due", title: "Essay", dueAt: DAY + 13 * HOUR_MS }),
      task({ id: "prep", title: "Prep", type: "prep", dueAt: DAY + 11 * HOUR_MS, status: "done" }),
      task({ id: "late", title: "Late", dueAt: DAY + 10 * HOUR_MS }),
      task({ id: "other-day", dueAt: DAY + DAY_MS }),
    ];
    const events = dayTimeline(DAY, [morning, afternoon, tomorrow], tasks, NOW);
    expect(events.map((e) => [e.kind, e.title, e.status])).toEqual([
      ["class", null, "past"],
      ["deadline", "Late", "overdue"],
      ["study", "Prep", "done"],
      ["deadline", "Essay", "next"],
      ["class", null, "upcoming"],
    ]);
  });

  it("marks a class in progress as now, and then no later event as next", () => {
    const current = session(DAY + 11 * HOUR_MS, 120, "m1"); // 11:00–13:00
    const later = session(DAY + 15 * HOUR_MS, 60, "m2");
    expect(dayTimeline(DAY, [current, later], [], NOW).map((e) => e.status)).toEqual(["now", "upcoming"]);
  });
});

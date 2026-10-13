// @vitest-environment jsdom
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/app/actions", () => ({
  createTaskAction: vi.fn(),
  setTaskStatusAction: vi.fn(),
  postponeTaskAction: vi.fn(),
  updateTaskAction: vi.fn(),
  deleteTaskAction: vi.fn(),
}));

import { DeadlinesData } from "@/components/deadlines-data";
import { PrepareData } from "@/components/prepare-data";
import { ReviewData } from "@/components/review-data";
import { TasksData, splitTasks } from "@/components/tasks-data";
import { TimetableData, pickDay } from "@/components/timetable-data";
import { TodayGreeting, TodayHeaderActions } from "@/components/today-header";
import { getDb } from "@/db/connection";
import { createCourse, getCourseByExternalId } from "@/db/courses";
import { createRule } from "@/db/rules";
import { createTask, listTasks, setTaskStatus } from "@/db/tasks";
import { importSnapshots } from "@/import/run";
import { DAY_MS, HOUR_MS, startOfShanghaiDay } from "@/lib/time";

const NOW = Date.parse("2026-10-12T04:00:00Z"); // Mon 12 Oct, 12:00 Shanghai
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-views-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

function importSample() {
  const snapshots = path.join(dir, "snapshots");
  mkdirSync(snapshots);
  copyFileSync("sample-data/courses-zju-sample.json", path.join(snapshots, "courses-zju-2026-10-12.json"));
  copyFileSync("sample-data/timetable-yjsy-sample.json", path.join(snapshots, "timetable-yjsy-2026-10-12.json"));
  const db = getDb();
  importSnapshots(db, snapshots, NOW);
  return db;
}

const search = (value: Record<string, string>) => Promise.resolve(value);

describe("TimetableData", () => {
  it("picks the day from the address, or today", () => {
    expect(pickDay("2026-10-14", NOW)).toBe(Date.parse("2026-10-13T16:00:00Z"));
    expect(pickDay(["2026-10-14", "2026-10-15"], NOW)).toBe(Date.parse("2026-10-13T16:00:00Z"));
    expect(pickDay("2026-02-31", NOW)).toBe(startOfShanghaiDay(NOW));
    expect(pickDay("tomorrow", NOW)).toBe(startOfShanghaiDay(NOW));
    expect(pickDay(undefined, NOW)).toBe(startOfShanghaiDay(NOW));
  });

  it("shows the chosen day's classes and the whole week", async () => {
    importSample();
    render(await TimetableData({ searchParams: search({ day: "2026-10-13" }) }));

    const days = screen.getByRole("navigation", { name: "Days of the week" });
    expect(within(days).getAllByRole("link")).toHaveLength(7);
    expect(within(days).getByRole("link", { name: "Tuesday, 13 October" })).toHaveAttribute("aria-current", "date");
    expect(within(days).getByRole("link", { name: "Monday, 12 October, today" })).toHaveAttribute("href", "/timetable");

    const day = screen.getByRole("list", { name: "Classes and deadlines, Tuesday, 13 October" });
    expect(within(day).getByText("Demo Strategy")).toBeInTheDocument();
    expect(within(day).getByText("Demo Hall 101")).toBeInTheDocument();

    const week = screen.getByRole("heading", { level: 2, name: "Week at a glance" }).closest("section") as HTMLElement;
    expect(within(week).getByText("Demo Chinese")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute("href", "/timetable");
  });

  it("explains an empty timetable", async () => {
    render(await TimetableData());
    expect(screen.getByRole("heading", { level: 2, name: "Your timetable is empty" })).toBeInTheDocument();
  });
});

describe("TasksData", () => {
  function seed() {
    const db = getDb();
    const course = createCourse(db, { title: "Demo Strategy" }, { now: NOW });
    createTask(db, { title: "Old essay", type: "assignment", courseId: course.id, dueAt: NOW - DAY_MS }, { now: NOW });
    createTask(db, { title: "Tonight", type: "reading", dueAt: NOW + 6 * HOUR_MS }, { now: NOW });
    createTask(db, { title: "Quiz 1", type: "exam", dueAt: NOW + 2 * DAY_MS }, { now: NOW });
    createTask(db, { title: "Someday", type: "personal" }, { now: NOW });
    const done = createTask(db, { title: "Lab 0", type: "assignment", dueAt: NOW - DAY_MS }, { now: NOW });
    setTaskStatus(db, done.id, "done", NOW - HOUR_MS);
    return db;
  }

  it("splits tasks into today, upcoming and completed", () => {
    const split = splitTasks(listTasks(seed(), { includeDone: true }), NOW);
    expect(split.overdue.map((t) => t.title)).toEqual(["Old essay"]);
    expect(split.today.map((t) => t.title)).toEqual(["Tonight"]);
    expect(split.upcoming.map((t) => t.title)).toEqual(["Quiz 1"]);
    expect(split.noDate.map((t) => t.title)).toEqual(["Someday"]);
    expect(split.completed.map((t) => t.title)).toEqual(["Lab 0"]);
  });

  it("shows today's tasks by default, with counts on each tab", async () => {
    seed();
    render(await TasksData());
    const tabs = screen.getByRole("navigation", { name: "Task views" });
    expect(within(tabs).getByRole("link", { name: "Today (2)" })).toHaveAttribute("aria-current", "page");
    expect(within(tabs).getByRole("link", { name: "Upcoming (2)" })).toHaveAttribute("href", "/tasks?view=upcoming");
    expect(within(screen.getByRole("region", { name: /^Overdue/ })).getByText("Old essay")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /^Due today/ })).getByRole("button", { name: 'Mark "Tonight" done' })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Add a task" })).toBeInTheDocument();
  });

  it("switches views from the address", async () => {
    seed();
    render(await TasksData({ searchParams: search({ view: "completed" }) }));
    expect(within(screen.getByRole("region", { name: /^Done in the last 7 days/ })).getByRole("button", { name: 'Reopen "Lab 0"' })).toBeInTheDocument();
    expect(screen.queryByText("Old essay")).not.toBeInTheDocument();
  });
});

describe("DeadlinesData filters", () => {
  it("filters by course, splits out today, and sorts by importance", async () => {
    const db = getDb();
    const strategy = createCourse(db, { title: "Demo Strategy" }, { now: NOW });
    const chinese = createCourse(db, { title: "Demo Chinese" }, { now: NOW });
    createTask(db, { title: "Tonight", type: "reading", courseId: strategy.id, dueAt: NOW + 6 * HOUR_MS }, { now: NOW });
    createTask(db, { title: "Low first", type: "assignment", courseId: strategy.id, dueAt: NOW + DAY_MS, importance: 1 }, { now: NOW });
    createTask(db, { title: "High second", type: "assignment", courseId: strategy.id, dueAt: NOW + 2 * DAY_MS, importance: 3 }, { now: NOW });
    createTask(db, { title: "Characters", type: "assignment", courseId: chinese.id, dueAt: NOW + DAY_MS }, { now: NOW });

    render(await DeadlinesData({ searchParams: Promise.resolve({ course: strategy.id, sort: "importance" }) }));

    expect(screen.queryByText("Characters")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /^Due today/ })).getByText("Tonight")).toBeInTheDocument();
    const week = screen.getByRole("region", { name: /^This week/ });
    expect(within(week).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent)).toEqual(["High second", "Low first"]);
    const chips = screen.getByRole("navigation", { name: "Filter by course" });
    expect(within(chips).getByRole("link", { name: "Demo Strategy" })).toHaveAttribute("aria-current", "page");
    expect(within(chips).getByRole("link", { name: "All courses" })).toHaveAttribute("href", "/deadlines?sort=importance");
    expect(screen.getByLabelText("Course")).toHaveValue(strategy.id);
  });
});

describe("PrepareData", () => {
  it("puts the next class first, with its prep task to mark ready", async () => {
    const db = importSample();
    const strategy = getCourseByExternalId(db, "tc:course:900001");
    if (!strategy) throw new Error("missing course");
    createRule(db, { courseId: strategy.id, title: "Prepare for class", leadMinutes: 720 });

    render(await PrepareData());
    const next = screen.getByRole("heading", { level: 2, name: "Demo Strategy" }).closest("section") as HTMLElement;
    expect(within(next).getByText("Tomorrow 8:50–12:25 · Demo Hall 101")).toBeInTheDocument();
    expect(within(next).getByRole("button", { name: /Mark ready/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "No class materials yet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Later this week" })).toBeInTheDocument();
  });

  it("explains when no class is coming up", async () => {
    render(await PrepareData());
    expect(screen.getByRole("heading", { level: 2, name: "No classes coming up" })).toBeInTheDocument();
  });
});

describe("ReviewData", () => {
  it("summarises this week and the next from existing tasks", async () => {
    const db = getDb();
    const done = createTask(db, { title: "Lab 0", type: "assignment", dueAt: NOW - HOUR_MS, estMinutes: 30 }, { now: NOW });
    setTaskStatus(db, done.id, "done", NOW - 2 * HOUR_MS);
    createTask(db, { title: "Quiz 1", type: "exam", dueAt: NOW + DAY_MS, estMinutes: 45 }, { now: NOW });
    createTask(db, { title: "Essay", type: "assignment", dueAt: NOW + 8 * DAY_MS }, { now: NOW });

    render(await ReviewData());
    const card = (name: string) => screen.getByRole("region", { name });
    expect(within(card("This week’s deadlines")).getByText("1 of 2")).toBeInTheDocument();
    expect(within(card("Time planned")).getByText("45 min")).toBeInTheDocument();
    expect(within(card("Completed tasks")).getByText("Lab 0")).toBeInTheDocument();
    expect(within(card("Focus for next week")).getByText("1 task")).toBeInTheDocument();
    expect(within(card("Focus for next week")).getByText("Essay")).toBeInTheDocument();
  });
});

describe("Today header", () => {
  it("greets by name when STUDENT_NAME is set", async () => {
    vi.stubEnv("STUDENT_NAME", " Can ");
    render(await TodayGreeting());
    expect(screen.getByText("Good afternoon, Can")).toBeInTheDocument();
  });

  it("greets without a name otherwise", async () => {
    vi.stubEnv("STUDENT_NAME", "");
    render(await TodayGreeting());
    expect(screen.getByText("Good afternoon")).toBeInTheDocument();
  });

  it("shows the date and counts what needs attention today", async () => {
    const db = getDb();
    createTask(db, { title: "Late", type: "assignment", dueAt: NOW - DAY_MS }, { now: NOW });
    createTask(db, { title: "Tonight", type: "reading", dueAt: NOW + HOUR_MS }, { now: NOW });
    createTask(db, { title: "Later", type: "reading", dueAt: NOW + 3 * DAY_MS }, { now: NOW });

    render(await TodayHeaderActions());
    expect(screen.getByText("Monday, 12 October")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deadlines: 2 due today or overdue" })).toHaveAttribute("href", "/deadlines");
    expect(screen.getByRole("link", { name: "Profile and settings" })).toHaveAttribute("href", "/settings");
  });
});

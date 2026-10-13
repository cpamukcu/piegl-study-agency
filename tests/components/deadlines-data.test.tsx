// @vitest-environment jsdom
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/app/actions", () => ({
  createTaskAction: vi.fn(),
  setTaskStatusAction: vi.fn(),
  postponeTaskAction: vi.fn(),
  updateTaskAction: vi.fn(),
  deleteTaskAction: vi.fn(),
}));

import { DeadlinesData } from "@/components/deadlines-data";
import { getDb } from "@/db/connection";
import { createCourse } from "@/db/courses";
import { createTask, setTaskStatus } from "@/db/tasks";
import { DAY_MS } from "@/lib/time";

const NOW = Date.parse("2026-10-12T04:00:00Z"); // Mon 12 Oct, 12:00 Shanghai
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-deadlines-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("DeadlinesData", () => {
  it("shows the add form and an empty state on first run", async () => {
    render(await DeadlinesData());
    expect(screen.getByRole("heading", { level: 2, name: "Add a task" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "No deadlines yet" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Weekly workload" })).not.toBeInTheDocument();
  });

  it("groups tasks with their course, due time and actions", async () => {
    const db = getDb();
    const course = createCourse(db, { title: "Demo Strategy" }, { now: NOW });
    createTask(db, { title: "Old essay", type: "assignment", courseId: course.id, dueAt: NOW - 2 * DAY_MS }, { now: NOW });
    createTask(db, { title: "Quiz 1", type: "exam", courseId: course.id, dueAt: NOW + DAY_MS, estMinutes: 30 }, { now: NOW });
    createTask(db, { title: "Final report", type: "assignment", dueAt: NOW + 20 * DAY_MS }, { now: NOW });
    createTask(db, { title: "Read notes", type: "reading" }, { now: NOW });
    const finished = createTask(db, { title: "Lab 0", type: "assignment", dueAt: NOW - DAY_MS }, { now: NOW });
    setTaskStatus(db, finished.id, "done", NOW - 3600_000);

    render(await DeadlinesData());

    const overdue = screen.getByRole("region", { name: /^Overdue/ });
    expect(within(overdue).getByText("Old essay")).toBeInTheDocument();
    expect(within(overdue).getByText("Demo Strategy")).toBeInTheDocument();
    expect(within(overdue).getByText("Overdue · Sat 10 Oct, 12:00")).toBeInTheDocument();

    const thisWeek = screen.getByRole("region", { name: /^This week/ });
    expect(within(thisWeek).getByText("Quiz 1")).toBeInTheDocument();
    expect(within(thisWeek).getByText("Tomorrow 12:00")).toBeInTheDocument();
    expect(within(thisWeek).getByRole("button", { name: 'Mark "Quiz 1" done' })).toBeInTheDocument();
    expect(within(thisWeek).getByRole("button", { name: 'Postpone "Quiz 1" by one day' })).toBeInTheDocument();

    expect(within(screen.getByRole("region", { name: /^Later/ })).getByText("Final report")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /^No date/ })).getByText("Read notes")).toBeInTheDocument();

    const done = screen.getByRole("region", { name: /^Done in the last 7 days/ });
    expect(within(done).getByRole("button", { name: 'Reopen "Lab 0"' })).toBeInTheDocument();

    const workload = screen.getByRole("region", { name: "Weekly workload" });
    expect(within(workload).getByText("This week")).toBeInTheDocument();
    expect(within(workload).getByText("30 min · 2 tasks · 1 without estimate")).toBeInTheDocument();
  });

  it("offers every course in the add form", async () => {
    createCourse(getDb(), { title: "Demo Chinese" }, { now: NOW });
    render(await DeadlinesData());
    expect(screen.getByRole("option", { name: "Demo Chinese" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAttribute("id", "task-title");
  });
});

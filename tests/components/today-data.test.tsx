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

import { TodayData } from "@/components/today-data";
import { getDb } from "@/db/connection";
import { getCourseByExternalId } from "@/db/courses";
import { createRule, materializePrepTasks } from "@/db/rules";
import { listTasks, setTaskStatus } from "@/db/tasks";
import { importSnapshots } from "@/import/run";

const NOW = Date.parse("2026-10-12T04:00:00Z"); // Mon 12 Oct, 12:00 Shanghai
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-today-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

const card = (name: string) => screen.getByRole("heading", { level: 2, name }).closest("section") as HTMLElement;

function importSample() {
  const snapshots = path.join(dir, "snapshots");
  mkdirSync(snapshots);
  copyFileSync("sample-data/courses-zju-sample.json", path.join(snapshots, "courses-zju-2026-10-12.json"));
  copyFileSync("sample-data/timetable-yjsy-sample.json", path.join(snapshots, "timetable-yjsy-2026-10-12.json"));
  const db = getDb();
  importSnapshots(db, snapshots, NOW);
  return db;
}

describe("TodayData", () => {
  it("answers the daily questions with gentle empty states on first run", async () => {
    render(await TodayData());
    for (const name of ["Up next", "Best next step", "Deadlines coming up", "Today’s timetable", "Study plan", "Things to revisit"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(within(card("Deadlines coming up")).getByText(/Add a course or a deadline/)).toBeInTheDocument();
    expect(within(card("Today’s timetable")).getByText(/No classes or deadlines today/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Add your first task/ })).toHaveAttribute("href", "/deadlines#new-task");
  });

  it("fills the cards from imported data", async () => {
    importSample();
    render(await TodayData());

    const due = card("Deadlines coming up");
    expect(within(due).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Characters L2",
      "Forum: Discussion week 5",
      "Quiz 1",
    ]);
    expect(within(due).getAllByText("In 2 days")).toHaveLength(2);
    expect(within(due).getByText("In 3 days")).toBeInTheDocument();

    const next = card("Up next");
    expect(within(next).getByText("Demo Strategy")).toBeInTheDocument();
    expect(within(next).getByText("Class starts Tomorrow 8:50")).toBeInTheDocument();
    expect(within(next).getByText("Demo Hall 101")).toBeInTheDocument();
    expect(within(next).getByRole("link", { name: "Add a prep routine" })).toBeInTheDocument();

    const top = card("Best next step");
    expect(within(top).getByText("Characters L2")).toBeInTheDocument();
    expect(within(top).getByText("Due Wed 12:00")).toBeInTheDocument();
    expect(within(top).getByRole("button", { name: 'Mark "Characters L2" done' })).toBeInTheDocument();

    const plan = card("Study plan");
    expect(within(plan).getByRole("button", { name: 'Mark "Quiz 1" done' })).toBeInTheDocument();
    expect(within(plan).getByRole("button", { name: 'Postpone "Quiz 1" by one day' })).toBeInTheDocument();

    const stats = screen.getByLabelText("This week at a glance");
    expect(within(stats).getByText("Due this week")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Quick actions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan my next hour" })).toHaveAttribute("href", "#focus-for-now");
    expect(screen.getByRole("region", { name: "Focus for now" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Focus duration" })).toBeInTheDocument();
  });

  it("shows the prep as done instead of offering a new routine", async () => {
    const db = importSample();
    const strategy = getCourseByExternalId(db, "tc:course:900001");
    if (!strategy) throw new Error("missing course");
    createRule(db, { courseId: strategy.id, title: "Prepare for class", leadMinutes: 720 });
    materializePrepTasks(db, NOW);
    const [prep] = listTasks(db).filter((t) => t.type === "prep");
    setTaskStatus(db, prep.id, "done", NOW);

    render(await TodayData());
    const next = card("Up next");
    expect(within(next).getByText("Prep done")).toBeInTheDocument();
    expect(within(next).queryByRole("link", { name: "Add a prep routine" })).not.toBeInTheDocument();
    expect(within(next).queryByRole("button", { name: /Mark prep done/ })).not.toBeInTheDocument();
  });

  it("offers to mark an open prep task done", async () => {
    const db = importSample();
    const strategy = getCourseByExternalId(db, "tc:course:900001");
    if (!strategy) throw new Error("missing course");
    createRule(db, { courseId: strategy.id, title: "Prepare for class", leadMinutes: 720 });

    render(await TodayData());
    const next = card("Up next");
    expect(within(next).getByRole("button", { name: /Mark prep done/ })).toBeInTheDocument();
  });
});

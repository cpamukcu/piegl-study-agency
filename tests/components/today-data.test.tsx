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

describe("TodayData", () => {
  it("answers the four daily questions with empty states on first run", async () => {
    render(await TodayData());
    for (const name of ["Due next", "Prepare next", "Highest-leverage task", "Confusing concepts"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(within(card("Due next")).getByText(/Nothing due yet/)).toBeInTheDocument();
  });

  it("fills the cards from imported data", async () => {
    const snapshots = path.join(dir, "snapshots");
    mkdirSync(snapshots);
    copyFileSync("sample-data/courses-zju-sample.json", path.join(snapshots, "courses-zju-2026-10-12.json"));
    copyFileSync("sample-data/timetable-yjsy-sample.json", path.join(snapshots, "timetable-yjsy-2026-10-12.json"));
    importSnapshots(getDb(), snapshots, NOW);

    render(await TodayData());

    const due = card("Due next");
    expect(within(due).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent)).toEqual([
      "Characters L2",
      "Forum: Discussion week 5",
      "Quiz 1",
    ]);

    const prepare = card("Prepare next");
    expect(within(prepare).getByText("Demo Strategy")).toBeInTheDocument();
    expect(within(prepare).getByText("Tomorrow 8:50 · Demo Hall 101")).toBeInTheDocument();
    expect(within(prepare).getByRole("link", { name: "Add a prep routine" })).toBeInTheDocument();

    const top = card("Highest-leverage task");
    expect(within(top).getByText("Characters L2")).toBeInTheDocument();
    expect(within(top).getByText("Due Wed 12:00")).toBeInTheDocument();
  });

  it("shows the prep as done instead of offering a new routine", async () => {
    const snapshots = path.join(dir, "snapshots");
    mkdirSync(snapshots);
    copyFileSync("sample-data/courses-zju-sample.json", path.join(snapshots, "courses-zju-2026-10-12.json"));
    copyFileSync("sample-data/timetable-yjsy-sample.json", path.join(snapshots, "timetable-yjsy-2026-10-12.json"));
    const db = getDb();
    importSnapshots(db, snapshots, NOW);
    const strategy = getCourseByExternalId(db, "tc:course:900001");
    if (!strategy) throw new Error("missing course");
    createRule(db, { courseId: strategy.id, title: "Prepare for class", leadMinutes: 720 });
    materializePrepTasks(db, NOW);
    const [prep] = listTasks(db).filter((t) => t.type === "prep");
    setTaskStatus(db, prep.id, "done", NOW);

    render(await TodayData());
    const prepare = card("Prepare next");
    expect(within(prepare).getByText("Prep done")).toBeInTheDocument();
    expect(within(prepare).queryByRole("link", { name: "Add a prep routine" })).not.toBeInTheDocument();
  });
});

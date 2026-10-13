// @vitest-environment jsdom
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/app/actions", () => ({
  createCourseAction: vi.fn(),
  updateCourseAction: vi.fn(),
  deleteCourseAction: vi.fn(),
  addMeetingAction: vi.fn(),
  deleteMeetingAction: vi.fn(),
  createRuleAction: vi.fn(),
  deleteRuleAction: vi.fn(),
  setTaskStatusAction: vi.fn(),
  postponeTaskAction: vi.fn(),
  updateTaskAction: vi.fn(),
  deleteTaskAction: vi.fn(),
}));

import { CourseDetail } from "@/components/course-detail";
import { CoursesData } from "@/components/courses-data";
import { getDb } from "@/db/connection";
import { createCourse } from "@/db/courses";
import { addMeetingTime } from "@/db/meetings";
import { createRule } from "@/db/rules";
import { upsertTerm } from "@/db/terms";

const NOW = Date.parse("2026-10-12T04:00:00Z");
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-courses-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

function seed() {
  const db = getDb();
  upsertTerm(db, { id: "t", name: "2026–2027", startDate: "2026-09-14", weeks: 18, periods: [] });
  const course = createCourse(db, { title: "Demo Strategy", code: "2026-13-9000001001", instructor: "Dr. Demo", links: ["https://example.edu/strategy"] }, { now: NOW });
  addMeetingTime(db, { courseId: course.id, termId: "t", weekday: 2, startMinute: 530, endMinute: 745, room: "Hall 1", weeks: [1, 3, 5, 7] });
  return { db, course };
}

describe("CoursesData", () => {
  it("shows an empty state and the add form on first run", async () => {
    render(await CoursesData());
    expect(screen.getByRole("heading", { level: 2, name: "No courses yet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Add a course" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAttribute("id", "course-title");
  });

  it("lists courses with their class times, linking to each course", async () => {
    const { course } = seed();
    render(await CoursesData());
    const link = screen.getByRole("link", { name: /Demo Strategy/ });
    expect(link).toHaveAttribute("href", `/courses/${course.id}`);
    expect(within(link).getByText("Tue 8:50–12:25 · Hall 1 · weeks 1, 3, 5, 7")).toBeInTheDocument();
    expect(within(link).getByText("2026-13-9000001001 · Dr. Demo")).toBeInTheDocument();
  });
});

describe("CourseDetail", () => {
  it("shows the course, its class times, prep routine and prep tasks", async () => {
    const { db, course } = seed();
    createRule(db, { courseId: course.id, title: "Prepare for class", leadMinutes: 720, estMinutes: 45 });
    render(await CourseDetail({ params: Promise.resolve({ id: course.id }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Demo Strategy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://example.edu/strategy" })).toHaveAttribute("target", "_blank");
    const times = screen.getByRole("region", { name: "Class times" });
    expect(within(times).getByText("Tue 8:50–12:25 · Hall 1 · weeks 1, 3, 5, 7")).toBeInTheDocument();
    const routine = screen.getByRole("region", { name: "Prep routine" });
    expect(within(routine).getByText("Prepare for class · due 12 hours before each class · about 45 min")).toBeInTheDocument();
    const tasks = screen.getByRole("region", { name: "Open tasks" });
    expect(within(tasks).getByText("Prepare for class · Tue 13 Oct")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Edit course" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete course" })).toBeInTheDocument();
  });

  it("is not found for an unknown course", async () => {
    await expect(CourseDetail({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

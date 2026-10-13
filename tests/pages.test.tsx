// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// DataFolder is an async server component (tested in data-folder.test.tsx);
// the client renderer used here cannot run it.
vi.mock("@/components/data-folder", () => ({
  DataFolder: () => <section aria-label="Data folder stub" />,
  DataFolderFallback: () => null,
}));
vi.mock("@/components/deadlines-data", () => ({
  DeadlinesData: () => <section aria-label="Deadlines stub" />,
}));
vi.mock("@/components/courses-data", () => ({
  CoursesData: () => <section aria-label="Courses stub" />,
}));
vi.mock("@/components/today-data", () => ({
  TodayData: () => <section aria-label="Today stub" />,
}));
vi.mock("@/components/import-section", () => ({
  ImportSection: () => null,
}));
vi.mock("@/components/today-header", () => ({
  TodayGreeting: () => null,
  TodayGreetingFallback: () => null,
  TodayHeaderActions: () => null,
}));
vi.mock("@/components/timetable-data", () => ({
  TimetableData: () => <section aria-label="Timetable stub" />,
}));
vi.mock("@/components/tasks-data", () => ({
  TasksData: () => <section aria-label="Tasks stub" />,
}));
vi.mock("@/components/prepare-data", () => ({
  PrepareData: () => <section aria-label="Prepare stub" />,
}));
vi.mock("@/components/review-data", () => ({
  ReviewData: () => <section aria-label="Review stub" />,
}));

import CoursesPage from "@/app/courses/page";
import DeadlinesPage from "@/app/deadlines/page";
import PracticePage from "@/app/practice/page";
import PreparePage from "@/app/prepare/page";
import ResearchPage from "@/app/research/page";
import ReviewPage from "@/app/review/page";
import SettingsPage from "@/app/settings/page";
import TasksPage from "@/app/tasks/page";
import TimetablePage from "@/app/timetable/page";
import TodayPage from "@/app/today/page";

type Page = (props: { params: Promise<never>; searchParams: Promise<Record<string, string>> }) => React.ReactNode;
const props = { params: Promise.resolve() as Promise<never>, searchParams: Promise.resolve({}) };

const PAGES: [string, Page, string][] = [
  ["today", TodayPage, "Your study day"],
  ["timetable", TimetablePage, "Timetable"],
  ["tasks", TasksPage, "Tasks"],
  ["courses", CoursesPage, "Courses"],
  ["deadlines", DeadlinesPage, "Deadlines"],
  ["prepare", PreparePage, "Prepare Class"],
  ["research", ResearchPage, "Research"],
  ["practice", PracticePage, "Practice"],
  ["review", ReviewPage, "Weekly Review"],
  ["settings", SettingsPage, "Settings"],
];

describe("screens", () => {
  it.each(PAGES)("%s page has its heading", (_name, Page, heading) => {
    render(<Page {...props} />);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  });

  it("Settings includes the data folder section", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("region", { name: "Data folder stub" })).toBeInTheDocument();
  });

  it("Settings lists the keyboard shortcuts", () => {
    render(<SettingsPage />);
    const shortcuts = screen.getByRole("region", { name: "Keyboard shortcuts" });
    expect(shortcuts).toHaveTextContent("New task");
    expect(shortcuts).toHaveTextContent("Go to Deadlines");
  });

  it.each([
    ["practice", PracticePage],
    ["settings", SettingsPage],
  ] as const)("%s shows the integrity note", (_name, Page) => {
    render(<Page />);
    expect(screen.getByRole("complementary", { name: "Academic integrity" })).toBeInTheDocument();
  });
});

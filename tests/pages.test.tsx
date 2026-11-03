// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
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
vi.mock("@/components/prepare-data", () => ({ PrepareData: () => <section aria-label="Prepare stub" /> }));
vi.mock("@/components/practice-data", () => ({ PracticeData: () => <section aria-label="Practice stub" /> }));
vi.mock("@/components/research-data", () => ({ ResearchData: () => <section aria-label="Research stub" /> }));
vi.mock("@/components/review-data", () => ({ ReviewData: () => <section aria-label="Review stub" /> }));

import CoursesPage from "@/app/courses/page";
import DeadlinesPage from "@/app/deadlines/page";
import PracticePage from "@/app/practice/page";
import PreparePage from "@/app/prepare/page";
import ResearchPage from "@/app/research/page";
import ReviewPage from "@/app/review/page";
import SettingsPage from "@/app/settings/page";
import TodayPage from "@/app/today/page";

// Pages that read the URL get empty params, as on a plain visit.
type Props = { params: Promise<Record<string, never>>; searchParams: Promise<Record<string, never>> };
const props: Props = { params: Promise.resolve({}), searchParams: Promise.resolve({}) };

const PAGES: [string, ComponentType<Props>, string][] = [
  ["today", TodayPage, "Today"],
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

  it.each([
    ["practice", PracticePage],
    ["settings", SettingsPage],
  ] as const)("%s shows the integrity note", (_name, Page) => {
    render(<Page {...props} />);
    expect(screen.getByRole("complementary", { name: "Academic integrity" })).toBeInTheDocument();
  });
});

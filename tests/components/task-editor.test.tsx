// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({ updateTaskAction: vi.fn(), deleteTaskAction: vi.fn() }));

import { TaskEditor } from "@/components/task-editor";
import { makeTask } from "../helpers/task";

describe("TaskEditor", () => {
  it("starts collapsed and is filled with the task's current values", () => {
    const task = makeTask({
      id: "t1",
      title: "Lab 1 - Submission",
      type: "assignment",
      courseId: "c1",
      dueAt: Date.parse("2026-10-19T15:59:00Z"),
      estMinutes: 90,
      importance: 3,
      notes: "use NodeXL",
    });
    const { container } = render(<TaskEditor task={task} />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(screen.getByText("Edit")).toHaveAttribute("aria-label", 'Edit "Lab 1 - Submission"');
    expect(screen.getByLabelText("Title")).toHaveValue("Lab 1 - Submission");
    expect(screen.getByLabelText("Due (Beijing time)")).toHaveValue("2026-10-19T23:59");
    expect(screen.getByLabelText("Estimated minutes")).toHaveValue(90);
    expect(screen.getByLabelText("Importance")).toHaveValue("3");
    expect(screen.getByLabelText("Notes")).toHaveValue("use NodeXL");
    expect(container.querySelector('input[name="type"]')).toHaveValue("assignment");
    expect(container.querySelector('input[name="courseId"]')).toHaveValue("c1");
    expect(screen.getByRole("button", { name: "Save", hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete task", hidden: true })).toBeInTheDocument();
  });

  it("leaves the due field empty for an undated task", () => {
    render(<TaskEditor task={makeTask({ id: "t2", dueAt: null })} />);
    expect(screen.getByLabelText("Due (Beijing time)")).toHaveValue("");
  });
});

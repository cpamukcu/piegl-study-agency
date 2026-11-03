// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({ setTaskStatusAction: vi.fn() }));

import { FocusDial, type FocusTask } from "@/components/focus-dial";
import { FOCUS_KEY } from "@/lib/focus-store";

const NOW = Date.parse("2026-10-12T04:00:00Z"); // 12:00 Shanghai
const TASKS: FocusTask[] = [
  { id: "t1", title: "Prepare Chinese L2", type: "prep", courseTitle: "Demo Chinese", courseColor: "#7a4e2d", estMinutes: 30 },
  { id: "t2", title: "Quiz 1 revision", type: "exam", courseTitle: "Demo Strategy", courseColor: "#2f5d62", estMinutes: null },
];

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const dial = () => screen.getByRole("region", { name: "Focus for now" });
const slider = () => within(dial()).getByRole("slider", { name: "Focus duration" });
const pressed = (name: string) => within(dial()).getByRole("button", { name, pressed: true });

function renderDial(tasks = TASKS) {
  return render(<FocusDial tasks={tasks} now={NOW} progress={{ done: 2, total: 4, scope: "today" }} />);
}

describe("FocusDial", () => {
  it("suggests the top task, its estimate and a matching mode", () => {
    renderDial();
    expect(slider()).toHaveAttribute("aria-valuenow", "30");
    expect(slider()).toHaveAttribute("aria-valuetext", "30 minutes");
    expect(within(dial()).getByText("Best for Prepare Chinese L2")).toBeInTheDocument();
    expect(pressed("Prepare")).toBeInTheDocument();
    expect(within(dial()).getByText("2 of 4 done today")).toBeInTheDocument();
    expect(within(dial()).getByRole("button", { name: "Start 30 min focus" })).toBeInTheDocument();
  });

  it("falls back to 45 minutes of deep work with no tasks", () => {
    renderDial([]);
    expect(slider()).toHaveAttribute("aria-valuenow", "45");
    expect(within(dial()).getByText("Free focus, no task chosen")).toBeInTheDocument();
    expect(pressed("Deep work")).toBeInTheDocument();
  });

  it("sets the duration from presets and the keyboard", () => {
    renderDial();
    fireEvent.click(within(dial()).getByRole("button", { name: "Set focus duration to 60 minutes" }));
    expect(slider()).toHaveAttribute("aria-valuenow", "60");
    expect(within(dial()).getByRole("button", { name: "Set focus duration to 60 minutes" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(slider(), { key: "ArrowLeft" });
    expect(slider()).toHaveAttribute("aria-valuenow", "55");
    fireEvent.keyDown(slider(), { key: "PageUp" });
    expect(slider()).toHaveAttribute("aria-valuenow", "70");
    fireEvent.keyDown(slider(), { key: "End" });
    expect(slider()).toHaveAttribute("aria-valuenow", "120");
    fireEvent.keyDown(slider(), { key: "Home" });
    expect(slider()).toHaveAttribute("aria-valuenow", "5");
  });

  it("takes a typed duration from the centre", () => {
    renderDial();
    fireEvent.click(within(dial()).getByRole("button", { name: /Focus duration 30 minutes/ }));
    const input = within(dial()).getByLabelText("Focus duration in minutes");
    fireEvent.change(input, { target: { value: "52" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(slider()).toHaveAttribute("aria-valuenow", "50");
  });

  it("switches task from the context row", () => {
    renderDial();
    fireEvent.click(within(dial()).getByRole("button", { name: /^Focus task: Prepare Chinese L2/ }));
    const picker = within(dial()).getByRole("group", { name: "Choose a task to focus on" });
    fireEvent.click(within(picker).getByRole("button", { name: /Quiz 1 revision/ }));
    expect(within(dial()).getByRole("button", { name: /^Focus task: Quiz 1 revision/ })).toBeInTheDocument();
    expect(within(dial()).getByText("For Quiz 1 revision")).toBeInTheDocument();
    expect(pressed("Practice")).toBeInTheDocument();
    expect(slider()).toHaveAttribute("aria-valuenow", "30"); // no estimate: keeps the chosen time
  });

  it("runs, pauses, resumes and completes a session", () => {
    renderDial();
    fireEvent.click(within(dial()).getByRole("button", { name: "Start 30 min focus" }));
    expect(within(dial()).queryByRole("slider")).not.toBeInTheDocument();
    expect(within(dial()).getByLabelText("30 minutes remaining")).toHaveTextContent("30:00");
    expect(within(dial()).getByRole("button", { name: "Set focus duration to 25 minutes" })).toBeDisabled();
    expect(document.title).toBe("30:00 · Focus");

    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(within(dial()).getByText("28:59")).toBeInTheDocument();

    fireEvent.click(within(dial()).getAllByRole("button", { name: "Pause session" })[0]);
    expect(within(dial()).getByText("Paused")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(within(dial()).getByText("28:59")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(FOCUS_KEY) ?? "{}")).toMatchObject({ status: "paused", taskId: "t1" });

    fireEvent.click(within(dial()).getAllByRole("button", { name: "Resume session" })[0]);
    act(() => {
      vi.advanceTimersByTime(29 * 60_000);
    });
    expect(within(dial()).getByText("Focus session complete")).toBeInTheDocument();
    expect(within(dial()).getByRole("status")).toHaveTextContent("Focus session complete.");
    expect(within(dial()).getByRole("button", { name: /Mark “Prepare Chinese L2” done/ })).toBeInTheDocument();

    fireEvent.click(within(dial()).getByRole("button", { name: "Plan what’s next" }));
    expect(slider()).toBeInTheDocument();
    expect(within(dial()).getByRole("button", { name: /^Focus task: Quiz 1 revision/ })).toBeInTheDocument();
    expect(within(dial()).getByRole("group", { name: "Choose a task to focus on" })).toBeInTheDocument();
  });

  it("can end a paused session early", () => {
    renderDial();
    fireEvent.click(within(dial()).getByRole("button", { name: "Start 30 min focus" }));
    fireEvent.click(within(dial()).getAllByRole("button", { name: "Pause session" })[0]);
    fireEvent.click(within(dial()).getByRole("button", { name: "End session" }));
    expect(slider()).toHaveAttribute("aria-valuenow", "30");
  });

  it("picks up a saved running session", () => {
    window.localStorage.setItem(
      FOCUS_KEY,
      JSON.stringify({ status: "running", minutes: 45, mode: "Review", taskId: "t2", endsAt: NOW + 10 * 60_000, remainingMs: null }),
    );
    renderDial();
    expect(within(dial()).getByText("10:00")).toBeInTheDocument();
    expect(within(dial()).getByRole("button", { name: /^Focus task: Quiz 1 revision/ })).toBeDisabled();
  });

  it("shows a finished session as complete even before the next tick", () => {
    window.localStorage.setItem(
      FOCUS_KEY,
      JSON.stringify({ status: "running", minutes: 25, mode: "Review", taskId: "t1", endsAt: NOW - 1000, remainingMs: null }),
    );
    renderDial();
    expect(within(dial()).getByText("Focus session complete")).toBeInTheDocument();
  });
});

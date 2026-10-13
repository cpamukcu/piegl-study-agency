// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { Shortcuts } from "@/components/shortcuts";

beforeEach(() => {
  push.mockClear();
});

describe("Shortcuts", () => {
  it("goes to the new-task form with n", () => {
    window.history.pushState({}, "", "/today");
    render(<Shortcuts />);
    fireEvent.keyDown(window, { key: "n" });
    expect(push).toHaveBeenCalledWith("/deadlines#new-task");
  });

  it("focuses the form directly when it is already on the page", () => {
    window.history.pushState({}, "", "/deadlines");
    render(
      <>
        <Shortcuts />
        <input id="task-title" aria-label="Title" />
      </>,
    );
    fireEvent.keyDown(window, { key: "n" });
    expect(document.activeElement?.id).toBe("task-title");
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores keys while typing and with modifier keys", () => {
    const { getByLabelText } = render(
      <>
        <Shortcuts />
        <input aria-label="Notes" />
      </>,
    );
    const input = getByLabelText("Notes");
    input.focus();
    fireEvent.keyDown(input, { key: "d" });
    fireEvent.keyDown(window, { key: "d", metaKey: true });
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates with t and d", () => {
    render(<Shortcuts />);
    fireEvent.keyDown(window, { key: "t" });
    fireEvent.keyDown(window, { key: "d" });
    expect(push.mock.calls).toEqual([["/today"], ["/deadlines"]]);
  });

  it("opens the shortcut list with ?", () => {
    const { container } = render(<Shortcuts />);
    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    expect(dialog).not.toHaveAttribute("open");
    fireEvent.keyDown(window, { key: "?" });
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveTextContent("New task");
  });
});

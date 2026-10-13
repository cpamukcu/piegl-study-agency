// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrityBanner } from "@/components/integrity-banner";
import { INTEGRITY_ACK_KEY } from "@/lib/integrity";

const banner = () => screen.queryByRole("region", { name: "Before you start" });

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IntegrityBanner", () => {
  it("shows on first run", () => {
    render(<IntegrityBanner />);
    expect(banner()).toBeInTheDocument();
    expect(banner()).toHaveTextContent(/responsible for your own work/);
  });

  it("hides after 'I understand' and remembers it", async () => {
    const { unmount } = render(<IntegrityBanner />);
    await userEvent.click(screen.getByRole("button", { name: "I understand" }));
    expect(banner()).not.toBeInTheDocument();
    expect(window.localStorage.getItem(INTEGRITY_ACK_KEY)).toBe("yes");

    unmount();
    render(<IntegrityBanner />);
    expect(banner()).not.toBeInTheDocument();
  });

  it("still works when browser storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    render(<IntegrityBanner />);
    expect(banner()).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "I understand" }));
    expect(banner()).not.toBeInTheDocument();
  });
});

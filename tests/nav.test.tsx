// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/courses/econ-101" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { Nav, NavLinks } from "@/components/nav";
import { isActive } from "@/lib/nav";

describe("isActive", () => {
  it("matches the section and its sub-pages only", () => {
    expect(isActive("/courses", "/courses")).toBe(true);
    expect(isActive("/courses/econ-101", "/courses")).toBe(true);
    expect(isActive("/courses-old", "/courses")).toBe(false);
    expect(isActive("/today", "/courses")).toBe(false);
  });
});

describe("Nav", () => {
  it("lists the eight sections in order", () => {
    render(<Nav />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Today",
      "Courses",
      "Deadlines",
      "Prepare Class",
      "Research",
      "Practice",
      "Weekly Review",
      "Settings",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/today",
      "/courses",
      "/deadlines",
      "/prepare",
      "/research",
      "/practice",
      "/review",
      "/settings",
    ]);
  });

  it("marks only the current section", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Today" })).not.toHaveAttribute("aria-current");
  });

  it("is a labelled navigation landmark", () => {
    render(<Nav />);
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});

describe("NavLinks", () => {
  it("renders the full menu with nothing marked while the current page is unknown", () => {
    render(<NavLinks pathname="" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(8);
    expect(links.filter((link) => link.hasAttribute("aria-current"))).toEqual([]);
  });
});

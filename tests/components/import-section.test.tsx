// @vitest-environment jsdom
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/app/actions", () => ({ importSnapshotsAction: vi.fn() }));

import { ImportSection } from "@/components/import-section";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-import-ui-"));
  vi.stubEnv("DATA_DIR", dir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("ImportSection", () => {
  it("disables the import button when there are no snapshots", async () => {
    render(await ImportSection());
    expect(screen.getByText("No snapshot files yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import ZJU snapshots" })).toBeDisabled();
  });

  it("lists the snapshot files found and offers an import", async () => {
    mkdirSync(path.join(dir, "snapshots"));
    copyFileSync("sample-data/courses-zju-sample.json", path.join(dir, "snapshots", "courses-zju-2026-10-12.json"));
    render(await ImportSection());
    expect(screen.getByText("courses-zju-2026-10-12.json")).toBeInTheDocument();
    expect(screen.getByText("Not imported yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import ZJU snapshots" })).toBeEnabled();
  });

  it("shows nothing when the data folder setting is broken", async () => {
    vi.stubEnv("DATA_DIR", "./data");
    const { container } = render((await ImportSection()) ?? <></>);
    expect(container).toBeEmptyDOMElement();
  });
});

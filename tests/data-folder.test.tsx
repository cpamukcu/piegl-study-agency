// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let releaseConnection: () => void = () => {};
vi.mock("next/server", () => ({
  connection: vi.fn(
    () =>
      new Promise<void>((resolve) => {
        releaseConnection = resolve;
      }),
  ),
}));

import { DataFolder } from "@/components/data-folder";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function renderDataFolder() {
  const pending = DataFolder();
  releaseConnection();
  render(await pending);
}

describe("DataFolder", () => {
  it("reads DATA_DIR only once a request arrives, not at build time", async () => {
    vi.stubEnv("DATA_DIR", "/tmp/psa-build-time");
    const pending = DataFolder();
    vi.stubEnv("DATA_DIR", "/tmp/psa-request-time");
    releaseConnection();
    render(await pending);
    expect(screen.getByText("/tmp/psa-request-time")).toBeInTheDocument();
  });

  it("shows the data folder", async () => {
    vi.stubEnv("DATA_DIR", "/tmp/psa-test-data");
    await renderDataFolder();
    expect(screen.getByRole("heading", { level: 2, name: "Data folder" })).toBeInTheDocument();
    expect(screen.getByText("/tmp/psa-test-data")).toBeInTheDocument();
  });

  it("explains a bad data folder instead of crashing", async () => {
    vi.stubEnv("DATA_DIR", "./data");
    await renderDataFolder();
    expect(screen.getByRole("alert")).toHaveTextContent(/absolute path/);
  });
});

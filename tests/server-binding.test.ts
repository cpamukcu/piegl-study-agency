import { describe, expect, it } from "vitest";
import pkg from "../package.json";

const scripts = pkg.scripts as Record<string, string>;

describe("server binding", () => {
  it.each(["dev", "start"])("%s listens on 127.0.0.1 only", (name) => {
    expect(scripts[name]).toMatch(/(?:-H|--hostname) 127\.0\.0\.1(?:\s|$)/);
  });

  it.each(["dev", "start"])("%s uses port 3100", (name) => {
    expect(scripts[name]).toMatch(/(?:-p|--port) 3100(?:\s|$)/);
  });
});

describe("telemetry", () => {
  it.each(["dev", "build", "start"])("%s turns off Next.js telemetry", (name) => {
    expect(scripts[name]).toMatch(/^NEXT_TELEMETRY_DISABLED=1 next /);
  });
});

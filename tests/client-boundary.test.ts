// Client components are bundled for the browser, so nothing they import (even
// indirectly) may reach Node built-ins or the database.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve("src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

function resolve(spec: string): string | null {
  if (!spec.startsWith("@/")) return null;
  const base = path.join(SRC, spec.slice(2));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

// Value imports only: "import type" and "export type" vanish at build time.
function imports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const found: string[] = [];
  for (const m of text.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+"([^"]+)"/gm)) found.push(m[1]);
  for (const m of text.matchAll(/^import\s+"([^"]+)"/gm)) found.push(m[1]);
  return found;
}

function forbiddenPath(start: string): string[] | null {
  const seen = new Set<string>();
  const walk = (file: string, trail: string[]): string[] | null => {
    if (seen.has(file)) return null;
    seen.add(file);
    for (const spec of imports(file)) {
      if (spec.startsWith("node:") || spec === "next/server") return [...trail, spec];
      // Server actions are fine: the bundler swaps them for references.
      if (spec === "@/app/actions") continue;
      const next = resolve(spec);
      if (next) {
        const hit = walk(next, [...trail, path.relative(SRC, next)]);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(start, [path.relative(SRC, start)]);
}

const clientFiles = files(SRC).filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));

describe("client components", () => {
  it("are found", () => {
    expect(clientFiles.length).toBeGreaterThan(5);
  });

  it.each(clientFiles.map((f) => [path.relative(SRC, f), f]))("%s imports nothing server-only", (_name, file) => {
    expect(forbiddenPath(file)).toBeNull();
  });
});

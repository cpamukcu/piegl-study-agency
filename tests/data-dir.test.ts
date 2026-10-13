import { mkdirSync, mkdtempSync, realpathSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DataDirError, ensureDataDir, resolveDataDir } from "@/lib/data-dir";

const repoRoot = "/work/study-agency";
const home = "/Users/student";
const base = { repoRoot, home, caseInsensitive: false };

describe("resolveDataDir", () => {
  it("defaults to ~/PIEGL-data", () => {
    expect(resolveDataDir(undefined, base)).toBe("/Users/student/PIEGL-data");
    expect(resolveDataDir("   ", base)).toBe("/Users/student/PIEGL-data");
  });

  it("expands ~ and ~/", () => {
    expect(resolveDataDir("~", base)).toBe("/Users/student");
    expect(resolveDataDir("~/Study/data", base)).toBe("/Users/student/Study/data");
  });

  it("accepts absolute paths outside the repo", () => {
    expect(resolveDataDir("/Volumes/USB/piegl", base)).toBe("/Volumes/USB/piegl");
  });

  it("accepts a sibling folder whose name starts like the repo", () => {
    expect(resolveDataDir("/work/study-agency-data", base)).toBe("/work/study-agency-data");
  });

  it("rejects relative paths", () => {
    expect(() => resolveDataDir("./data", base)).toThrow(DataDirError);
    expect(() => resolveDataDir("data", base)).toThrow(/absolute path/);
  });

  it("rejects the repo itself and anything inside it", () => {
    expect(() => resolveDataDir("/work/study-agency", base)).toThrow(DataDirError);
    expect(() => resolveDataDir("/work/study-agency/data", base)).toThrow(/outside the repository/);
    expect(() => resolveDataDir("/work/study-agency/../study-agency/data", base)).toThrow(DataDirError);
  });

  it("rejects a folder inside the repo named like '..x'", () => {
    expect(() => resolveDataDir("/work/study-agency/..x", base)).toThrow(DataDirError);
  });

  it("treats paths case-insensitively when asked (macOS)", () => {
    const mac = { ...base, caseInsensitive: true };
    expect(() => resolveDataDir("/WORK/Study-Agency/data", mac)).toThrow(DataDirError);
    expect(resolveDataDir("/WORK/Study-Agency/data", base)).toBe("/WORK/Study-Agency/data");
  });
});

describe("resolveDataDir with symlinks", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  function makeRepoAndLink(): { repo: string; link: string } {
    root = mkdtempSync(path.join(tmpdir(), "psa-"));
    const repo = path.join(root, "repo");
    const link = path.join(root, "link");
    mkdirSync(repo);
    symlinkSync(repo, link);
    return { repo, link };
  }

  it("rejects a DATA_DIR that reaches the repo through a symlink", () => {
    const { repo, link } = makeRepoAndLink();
    const options = { repoRoot: realpathSync(repo), home, caseInsensitive: false };
    expect(() => resolveDataDir(path.join(link, "notes"), options)).toThrow(DataDirError);
  });

  it("rejects a DATA_DIR inside the repo when the repo root is a symlink", () => {
    const { repo, link } = makeRepoAndLink();
    const options = { repoRoot: link, home, caseInsensitive: false };
    expect(() => resolveDataDir(path.join(realpathSync(repo), "notes"), options)).toThrow(DataDirError);
  });

  it("still accepts a real folder next to the repo", () => {
    const { link } = makeRepoAndLink();
    const options = { repoRoot: link, home, caseInsensitive: false };
    const outside = path.join(root!, "PIEGL-data");
    expect(resolveDataDir(outside, options)).toBe(outside);
  });
});

describe("ensureDataDir", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it("creates a private nested folder and returns it", () => {
    root = mkdtempSync(path.join(tmpdir(), "psa-"));
    const dir = path.join(root, "a", "b");
    expect(ensureDataDir(dir)).toBe(dir);
    expect(statSync(dir).isDirectory()).toBe(true);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
  });

  it("is fine when the folder already exists", () => {
    root = mkdtempSync(path.join(tmpdir(), "psa-"));
    expect(ensureDataDir(root)).toBe(root);
  });
});

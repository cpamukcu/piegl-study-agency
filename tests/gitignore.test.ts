import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function isIgnored(path: string): boolean {
  try {
    // Force case-sensitive matching: macOS repos default to core.ignorecase=true,
    // which would hide missing upper-case rules here but not on a Linux clone.
    execFileSync("git", ["-c", "core.ignorecase=false", "check-ignore", "--quiet", "--no-index", path], {
      stdio: "ignore",
    });
    return true;
  } catch (error) {
    if ((error as { status?: number }).status === 1) return false;
    throw error;
  }
}

const MUST_IGNORE = [
  ".env",
  ".env.local",
  ".env.production",
  "data/study.db",
  "uploads/week1.pdf",
  "extracted/week1.txt",
  "sessions/zju.json",
  "playwright/.auth/state.json",
  "study.db",
  "study.db-wal",
  "study.sqlite",
  "study.sqlite-shm",
  "study.sqlite3",
  "study.sqlite3-wal",
  "study.sqlite3-journal",
  "Study.DB",
  "logs/sync.txt",
  "sync.log",
  "slides.pdf",
  "Slides.PDF",
  "deck.ppt",
  "deck.pptx",
  "Week3.PPTX",
  "deck.Pptx",
  "notes.pptm",
  "Slides.Pdf",
  "reading.docx",
  "Reading.DOCX",
  "essay.docm",
  "Essay.Doc",
  "private.key",
  "Private.Key",
  "cert.pem",
  ".DS_Store",
  "coverage/index.html",
  "node_modules/next/package.json",
  ".next/cache/x",
  ".claude/settings.local.json",
];

const MUST_KEEP = [
  ".env.example",
  ".gitignore",
  ".dockerignore",
  "package.json",
  "README.md",
  "src/app/today/page.tsx",
  "docs/PRIVACY.md",
  "sample-data/courses-zju-sample.json",
  "sample-data/timetable-yjsy-sample.json",
  "tests/gitignore.test.ts",
];

describe(".gitignore", () => {
  it.each(MUST_IGNORE)("ignores %s", (path) => {
    expect(isIgnored(path)).toBe(true);
  });

  it.each(MUST_KEEP)("keeps %s", (path) => {
    expect(isIgnored(path)).toBe(false);
  });

  it("has no ignored files already tracked", () => {
    const tracked = execFileSync("git", ["ls-files", "--cached", "--ignored", "--exclude-standard"], {
      encoding: "utf8",
    });
    expect(tracked.trim()).toBe("");
  });
});

import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { all, getDb, migrate, one, openDb, transaction } from "@/db/connection";
import { MIGRATIONS } from "@/db/schema";

describe("openDb", () => {
  it("creates every table and records the schema version", () => {
    const db = openDb(":memory:");
    const tables = all<{ name: string }>(
      db,
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    ).map((r) => r.name);
    expect(tables).toEqual(["courses", "import_runs", "meeting_times", "recurrence_rules", "tasks", "terms"]);
    expect(one<{ user_version: number }>(db, "PRAGMA user_version")?.user_version).toBe(MIGRATIONS.length);
  });

  it("is safe to migrate twice", () => {
    const db = openDb(":memory:");
    expect(() => migrate(db)).not.toThrow();
  });

  it("enforces foreign keys", () => {
    const db = openDb(":memory:");
    expect(() =>
      db
        .prepare(
          "INSERT INTO meeting_times (id, course_id, weekday, start_minute, end_minute) VALUES ('m', 'missing', 1, 60, 120)",
        )
        .run(),
    ).toThrow(/FOREIGN KEY/);
  });

  it("rejects out-of-range values", () => {
    const db = openDb(":memory:");
    expect(() =>
      db
        .prepare(
          "INSERT INTO tasks (id, type, title, importance, created_at, updated_at) VALUES ('t', 'assignment', 'x', 5, 0, 0)",
        )
        .run(),
    ).toThrow(/CHECK/);
  });
});

describe("transaction", () => {
  it("rolls back everything when the work throws", () => {
    const db = openDb(":memory:");
    expect(() =>
      transaction(db, () => {
        db.prepare("INSERT INTO terms (id, name, start_date, weeks) VALUES ('t1', 'T', '2026-09-14', 18)").run();
        throw new Error("stop");
      }),
    ).toThrow("stop");
    expect(all(db, "SELECT * FROM terms")).toEqual([]);
  });
});

describe("getDb", () => {
  let dir: string | undefined;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("keeps one private database file in DATA_DIR", () => {
    dir = mkdtempSync(path.join(tmpdir(), "psa-db-"));
    vi.stubEnv("DATA_DIR", dir);
    const db = getDb();
    expect(getDb()).toBe(db);
    expect(statSync(path.join(dir, "study.db")).mode & 0o777).toBe(0o600);
  });
});

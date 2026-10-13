# M1 Courses and Deadlines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the M0 shell into a working course and deadline command center: a local SQLite database, courses with class times, all task types, recurring class-prep tasks, an explained priority, a weekly workload view, a real Today page, keyboard shortcuts, and a one-click import of the owner's ZJU snapshots.

**Architecture:** Server-side SQLite through Node 24's built-in `node:sqlite`, stored at `DATA_DIR/study.db`. Small repository modules (`src/db/*`) own all SQL. Pure, tested logic (`src/lib/*`, `src/import/*`) handles time, sessions, priority, workload and snapshot mapping. Pages render data inside `<Suspense>` after `await connection()` (Cache Components is on). Mutations are Server Actions that validate with Zod and call `refresh()`.

**Tech Stack:** Next.js 16.4 (App Router, Cache Components), React 19, TypeScript, Tailwind 4, `node:sqlite` (Node 24), Zod 4, Vitest 5 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-12-piegl-study-agency-design.md`. Data sources: `docs/data-sources.md`.

**Changes from spec (owner approved snapshot import on 2026-10-12; the rest are flagged for review):**
- Snapshot import replaces the demo seed. Demo data lives only in `sample-data/` and tests.
- Database access uses `node:sqlite` with hand-written SQL instead of Drizzle. Drizzle only supports `better-sqlite3`, a native add-on that npm 11's install-script policy may block from building; `node:sqlite` needs no install.
- `ClassSession` is computed from class times and the term calendar, not stored. A stored table arrives in M4, when briefs attach to sessions.

## Global Constraints

- Everything from M0 still holds: bind to `127.0.0.1:3100`, private data only under `DATA_DIR`, no real ZJU data, credentials, or cookies in the repo, telemetry off.
- The database file is `DATA_DIR/study.db`, created with mode `0600`.
- All times are stored as UTC milliseconds and shown in Shanghai time (UTC+8, no daylight saving), whatever time zone the Mac uses. Never use local-time `Date` methods (`getHours`, `toLocaleString` without `timeZone`, etc.).
- Every page that reads the database renders that part inside `<Suspense>` and calls `await connection()` from `next/server` first.
- Files with `"use server"` export only async functions. Shared types and constants for actions live in `src/lib/action-state.ts`.
- Tests use only fake data from `sample-data/` or built inline. Never copy anything from `~/PIEGL-data/snapshots/` into the repo.
- English UI, short plain words. Calm look: use the existing tokens (`bg-paper`, `bg-surface`, `text-ink`, `text-ink-muted`, `border-line`, `bg-accent`, `text-warn`). No new colors except course colors.
- Small commits. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Re-importing snapshots after the owner edited things (renamed a course, changed a task's importance, marked a task done) must keep those edits. Pinned in Task 7.
2. The Mac's time zone is not Shanghai (e.g. the owner flies home to Istanbul): an assignment due 23:59 Beijing time must still show on the right day and time. Pinned in Task 1.
3. A malformed or older-format snapshot file must fail with a clear message and change nothing in the database. Pinned in Task 7.
4. First run with an empty database: Today, Deadlines and Courses show empty states and never crash. Pinned in Tasks 9, 11 and 12.
5. Junk form input (empty title, `2026-02-30T10:00`, negative minutes, end time before start time, a non-web link) gives a field error and saves nothing. Pinned in Task 8.

---

### Task 1: Shanghai time helpers

**Files:**
- Create: `src/lib/time.ts`
- Test: `tests/lib/time.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all pure):
  - `SHANGHAI_OFFSET_MS`, `MINUTE_MS`, `HOUR_MS`, `DAY_MS`
  - `type ShanghaiParts = { year; month; day; hour; minute; weekday }` (weekday 1 = Monday … 7 = Sunday)
  - `shanghaiParts(ms: number): ShanghaiParts`
  - `startOfShanghaiDay(ms: number): number`, `startOfShanghaiWeek(ms: number): number` (Monday 00:00)
  - `shanghaiToMs(date: "YYYY-MM-DD", minutes?: number): number` (throws on a non-real date)
  - `parseLocalDateTime(value: string): number | null` (for `<input type="datetime-local">`)
  - `toLocalDateTimeInput(ms: number): string`
  - `parseClock(value: "HH:MM"): number | null` (minutes after midnight), `formatClock(minutes: number): string` (`"8:50"`)
  - `hhmmToMinutes(hhmm: number): number` (`850` → `530`)
  - `weekdayName(weekday: number): string` (`"Mon"`)
  - `formatDate(ms: number): string` (`"Mon 12 Oct"`)
  - `formatDue(ms: number, now: number): string`
  - `humanDuration(ms: number): string`, `formatMinutes(minutes: number): string`

- [ ] **Step 1: Write the failing test**

`tests/lib/time.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import {
  DAY_MS,
  formatClock,
  formatDate,
  formatDue,
  formatMinutes,
  hhmmToMinutes,
  humanDuration,
  parseClock,
  parseLocalDateTime,
  shanghaiParts,
  shanghaiToMs,
  startOfShanghaiDay,
  startOfShanghaiWeek,
  toLocalDateTimeInput,
  weekdayName,
} from "@/lib/time";

const at = (iso: string) => Date.parse(iso);
// Monday 12 Oct 2026, 12:00 in Shanghai.
const NOW = at("2026-10-12T04:00:00Z");

describe("shanghaiParts", () => {
  it("reads an instant as Shanghai wall time", () => {
    expect(shanghaiParts(at("2026-10-12T04:27:00Z"))).toEqual({
      year: 2026,
      month: 10,
      day: 12,
      hour: 12,
      minute: 27,
      weekday: 1,
    });
  });

  it("rolls over to the next Shanghai day after 16:00 UTC", () => {
    expect(shanghaiParts(at("2026-10-18T16:30:00Z"))).toMatchObject({ day: 19, hour: 0, weekday: 1 });
  });
});

describe("day and week starts", () => {
  it("finds Shanghai midnight", () => {
    expect(startOfShanghaiDay(at("2026-10-11T17:00:00Z"))).toBe(at("2026-10-11T16:00:00Z"));
  });

  it("finds Monday 00:00 of the Shanghai week, even late on Sunday", () => {
    expect(startOfShanghaiWeek(at("2026-10-18T15:00:00Z"))).toBe(at("2026-10-11T16:00:00Z"));
    expect(startOfShanghaiWeek(NOW)).toBe(at("2026-10-11T16:00:00Z"));
  });
});

describe("parsing", () => {
  it("turns a Shanghai date and minutes into an instant", () => {
    expect(shanghaiToMs("2026-09-14")).toBe(at("2026-09-13T16:00:00Z"));
    expect(shanghaiToMs("2026-10-13", 530)).toBe(at("2026-10-13T00:50:00Z"));
  });

  it("refuses dates that do not exist", () => {
    expect(() => shanghaiToMs("2026-02-30")).toThrow(/real date/);
    expect(() => shanghaiToMs("13/10/2026")).toThrow(/Not a date/);
  });

  it("parses datetime-local input as Shanghai time", () => {
    expect(parseLocalDateTime("2026-10-19T23:59")).toBe(at("2026-10-19T15:59:00Z"));
    expect(parseLocalDateTime(" 2026-10-19T08:05 ")).toBe(at("2026-10-19T00:05:00Z"));
  });

  it("returns null for bad datetime-local input", () => {
    for (const bad of ["", "2026-10-19", "2026-02-30T10:00", "2026-10-19T24:00", "2026-10-19T10:60", "soon"]) {
      expect(parseLocalDateTime(bad)).toBeNull();
    }
  });

  it("round-trips datetime-local values", () => {
    expect(toLocalDateTimeInput(at("2026-10-19T15:59:00Z"))).toBe("2026-10-19T23:59");
  });

  it("parses and formats clock times", () => {
    expect(parseClock("08:50")).toBe(530);
    expect(parseClock("21:20")).toBe(1280);
    expect(parseClock("25:00")).toBeNull();
    expect(parseClock("")).toBeNull();
    expect(formatClock(530)).toBe("8:50");
    expect(formatClock(1350)).toBe("22:30");
    expect(hhmmToMinutes(850)).toBe(530);
    expect(hhmmToMinutes(2230)).toBe(1350);
  });
});

describe("formatting", () => {
  it("names weekdays and dates", () => {
    expect(weekdayName(1)).toBe("Mon");
    expect(weekdayName(7)).toBe("Sun");
    expect(formatDate(NOW)).toBe("Mon 12 Oct");
  });

  it("describes due times relative to now", () => {
    expect(formatDue(at("2026-10-12T15:59:00Z"), NOW)).toBe("Today 23:59");
    expect(formatDue(at("2026-10-13T04:00:00Z"), NOW)).toBe("Tomorrow 12:00");
    expect(formatDue(at("2026-10-15T14:00:00Z"), NOW)).toBe("Thu 22:00");
    expect(formatDue(at("2026-10-17T05:00:00Z"), NOW)).toBe("Sat 13:00");
    expect(formatDue(at("2026-11-01T11:00:00Z"), NOW)).toBe("Sun 1 Nov, 19:00");
    expect(formatDue(at("2026-10-11T11:00:00Z"), NOW)).toBe("Yesterday 19:00");
    expect(formatDue(at("2026-10-10T11:00:00Z"), NOW)).toBe("Sat 10 Oct, 19:00");
  });

  it("describes durations in plain words", () => {
    expect(humanDuration(45 * 60_000)).toBe("45 min");
    expect(humanDuration(60 * 60_000)).toBe("1 hour");
    expect(humanDuration(5 * 3_600_000)).toBe("5 hours");
    expect(humanDuration(DAY_MS)).toBe("24 hours");
    expect(humanDuration(3 * DAY_MS)).toBe("3 days");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(210)).toBe("3 h 30 min");
  });
});

describe("time zone independence", () => {
  const original = process.env.TZ;

  afterEach(() => {
    process.env.TZ = original;
  });

  it("shows Shanghai time even when the Mac is set to Istanbul", () => {
    process.env.TZ = "Europe/Istanbul";
    expect(formatDue(at("2026-10-19T15:59:00Z"), NOW)).toBe("Mon 19 Oct, 23:59");
    expect(parseLocalDateTime("2026-10-19T23:59")).toBe(at("2026-10-19T15:59:00Z"));
    expect(startOfShanghaiWeek(NOW)).toBe(at("2026-10-11T16:00:00Z"));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/lib/time.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/time".

- [ ] **Step 3: Implement**

`src/lib/time.ts`:

```ts
// All app times are shown in Shanghai time (UTC+8, no daylight saving), whatever
// time zone the Mac is set to. Instants are stored as UTC milliseconds. Only UTC
// Date methods are used here, shifted by the fixed offset.
export const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export type ShanghaiParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function shanghaiParts(ms: number): ShanghaiParts {
  const d = new Date(ms + SHANGHAI_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: ((d.getUTCDay() + 6) % 7) + 1,
  };
}

export function startOfShanghaiDay(ms: number): number {
  return Math.floor((ms + SHANGHAI_OFFSET_MS) / DAY_MS) * DAY_MS - SHANGHAI_OFFSET_MS;
}

export function startOfShanghaiWeek(ms: number): number {
  const day = startOfShanghaiDay(ms);
  return day - (shanghaiParts(day).weekday - 1) * DAY_MS;
}

export function shanghaiToMs(date: string, minutes = 0): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Not a date: "${date}"`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const midnight = Date.UTC(year, month - 1, day) - SHANGHAI_OFFSET_MS;
  const check = shanghaiParts(midnight);
  if (check.year !== year || check.month !== month || check.day !== day) {
    throw new Error(`Not a real date: "${date}"`);
  }
  return midnight + minutes * MINUTE_MS;
}

export function parseLocalDateTime(value: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[2]);
  const minute = Number(m[3]);
  if (hour > 23 || minute > 59) return null;
  try {
    return shanghaiToMs(m[1], hour * 60 + minute);
  } catch {
    return null;
  }
}

export function toLocalDateTimeInput(ms: number): string {
  const p = shanghaiParts(ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function formatClock(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

export function hhmmToMinutes(hhmm: number): number {
  return Math.floor(hhmm / 100) * 60 + (hhmm % 100);
}

export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday - 1] ?? "?";
}

export function formatDate(ms: number): string {
  const p = shanghaiParts(ms);
  return `${WEEKDAYS[p.weekday - 1]} ${p.day} ${MONTHS[p.month - 1]}`;
}

export function formatDue(ms: number, now: number): string {
  const p = shanghaiParts(ms);
  const clock = formatClock(p.hour * 60 + p.minute);
  const days = Math.round((startOfShanghaiDay(ms) - startOfShanghaiDay(now)) / DAY_MS);
  if (days === 0) return `Today ${clock}`;
  if (days === 1) return `Tomorrow ${clock}`;
  if (days === -1) return `Yesterday ${clock}`;
  if (days > 1 && days < 7) return `${WEEKDAYS[p.weekday - 1]} ${clock}`;
  return `${formatDate(ms)}, ${clock}`;
}

export function humanDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE_MS));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) {
    const hours = Math.round(minutes / 60);
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const days = Math.round(minutes / (24 * 60));
  return days === 1 ? "1 day" : `${days} days`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/lib/time.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/time.ts tests/lib/time.test.ts
git commit -m "Add Shanghai time helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: SQLite database and schema

**Files:**
- Create: `src/db/schema.ts`, `src/db/connection.ts`
- Test: `tests/db/connection.test.ts`

**Interfaces:**
- Consumes: `ensureDataDir`, `getDataDir` from `@/lib/data-dir` (M0).
- Produces (server-only):
  - `MIGRATIONS: string[]` (index + 1 = schema version)
  - `type Db = DatabaseSync`
  - `openDb(file: string): Db` (`":memory:"` allowed), `migrate(db: Db): void`
  - `getDb(): Db` (one shared connection per `DATA_DIR`, file `study.db`)
  - `transaction<T>(db: Db, fn: () => T): T`
  - `all<T>(db: Db, sql: string, ...params: SQLInputValue[]): T[]`, `one<T>(db: Db, sql: string, ...params: SQLInputValue[]): T | null`

- [ ] **Step 1: Write the failing test**

`tests/db/connection.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/db/connection.test.ts`
Expected: FAIL with "Failed to resolve import @/db/connection".

- [ ] **Step 3: Implement**

`src/db/schema.ts`:

```ts
// Each entry is one migration; never edit an entry that has shipped, add a new one.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE terms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    weeks INTEGER NOT NULL CHECK (weeks > 0),
    periods_json TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    code TEXT,
    instructor TEXT,
    semester TEXT,
    color TEXT NOT NULL DEFAULT '#2f5d62',
    links_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    ai_allowed INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'zju')),
    external_id TEXT UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE meeting_times (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    term_id TEXT REFERENCES terms(id) ON DELETE SET NULL,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
    end_minute INTEGER NOT NULL CHECK (end_minute > start_minute AND end_minute <= 1440),
    room TEXT,
    weeks_json TEXT NOT NULL DEFAULT '[]',
    external_id TEXT UNIQUE
  );

  CREATE TABLE recurrence_rules (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    lead_minutes INTEGER NOT NULL CHECK (lead_minutes >= 0),
    est_minutes INTEGER CHECK (est_minutes > 0),
    importance INTEGER NOT NULL DEFAULT 2 CHECK (importance BETWEEN 1 AND 3),
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('assignment', 'reading', 'presentation', 'exam', 'personal', 'prep')),
    title TEXT NOT NULL,
    due_at INTEGER,
    est_minutes INTEGER CHECK (est_minutes > 0),
    importance INTEGER NOT NULL DEFAULT 2 CHECK (importance BETWEEN 1 AND 3),
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done', 'postponed')),
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'zju', 'rule')),
    external_id TEXT UNIQUE,
    rule_id TEXT REFERENCES recurrence_rules(id) ON DELETE SET NULL,
    occurrence_key TEXT,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (rule_id, occurrence_key)
  );

  CREATE INDEX tasks_due_at ON tasks(due_at);

  CREATE TABLE import_runs (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    file_name TEXT NOT NULL,
    imported_at INTEGER NOT NULL,
    counts_json TEXT NOT NULL
  );
  `,
];
```

`src/db/connection.ts`:

```ts
// Server-only: the one place that opens the SQLite database. Never import from a client component.
import { chmodSync, existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { MIGRATIONS } from "@/db/schema";
import { ensureDataDir, getDataDir } from "@/lib/data-dir";

export type Db = DatabaseSync;

export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function all<T>(db: Db, sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

export function one<T>(db: Db, sql: string, ...params: SQLInputValue[]): T | null {
  return (db.prepare(sql).get(...params) as unknown as T | undefined) ?? null;
}

export function migrate(db: Db): void {
  const current = one<{ user_version: number }>(db, "PRAGMA user_version")?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

export function openDb(file: string): Db {
  const inMemory = file === ":memory:";
  const isNew = !inMemory && !existsSync(file);
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  if (!inMemory) db.exec("PRAGMA journal_mode = WAL");
  if (isNew) chmodSync(file, 0o600);
  migrate(db);
  return db;
}

// Kept on globalThis so dev-server reloads reuse the open connection.
const cache = globalThis as typeof globalThis & { __psaDbs?: Map<string, Db> };

export function getDb(): Db {
  const file = path.join(ensureDataDir(getDataDir()), "study.db");
  cache.__psaDbs ??= new Map();
  let db = cache.__psaDbs.get(file);
  if (!db) {
    db = openDb(file);
    cache.__psaDbs.set(file, db);
  }
  return db;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/db/connection.test.ts`
Expected: PASS.

- [ ] **Step 5: Run all checks and commit**

Run: `npm run check`
Expected: all PASS.

```bash
git add src/db/schema.ts src/db/connection.ts tests/db/connection.test.ts
git commit -m "Add SQLite database with schema migrations" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Repositories for courses, class times, terms and tasks

**Files:**
- Create: `src/db/courses.ts`, `src/db/meetings.ts`, `src/db/terms.ts`, `src/db/tasks.ts`
- Create: `tests/helpers/db.ts`
- Test: `tests/db/repos.test.ts`

**Interfaces:**
- Consumes: `Db`, `all`, `one` from `@/db/connection`.
- Produces:
  - `@/db/courses`: `COURSE_COLORS`, `type Course = { id; title; code: string | null; instructor: string | null; semester: string | null; color; links: string[]; notes: string | null; aiAllowed: boolean; source: "manual" | "zju"; externalId: string | null; createdAt; updatedAt }`, `type CourseInput = { title; code?; instructor?; semester?; color?; links?; notes? }`, `listCourses(db)`, `getCourse(db, id)`, `getCourseByExternalId(db, externalId)`, `createCourse(db, input, options?: { now?; source?; externalId? })`, `updateCourse(db, id, input, now?)`, `deleteCourse(db, id)`
  - `@/db/meetings`: `type MeetingTime = { id; courseId; termId: string | null; weekday; startMinute; endMinute; room: string | null; weeks: number[]; externalId: string | null }`, `type MeetingInput = Omit<MeetingTime, "id" | "termId" | "room" | "weeks" | "externalId"> & { termId?; room?; weeks?; externalId? }`, `listMeetingTimes(db, courseId?)`, `addMeetingTime(db, input)`, `deleteMeetingTime(db, id)`, `deleteMeetingTimesByExternalPrefix(db, prefix): number`
  - `@/db/terms`: `type Period = { period; startMinute; endMinute }`, `type Term = { id; name; startDate; weeks; periods: Period[] }`, `upsertTerm(db, term)`, `listTerms(db)`, `currentTerm(terms: Term[], now): Term | null` (pure)
  - `@/db/tasks`: `TASK_TYPES`, `type TaskType`, `TASK_STATUSES`, `type TaskStatus`, `type Importance = 1 | 2 | 3`, `type Task = { id; courseId: string | null; type; title; dueAt: number | null; estMinutes: number | null; importance; status; notes: string | null; source: "manual" | "zju" | "rule"; externalId: string | null; ruleId: string | null; occurrenceKey: string | null; completedAt: number | null; createdAt; updatedAt }`, `type TaskInput = { title; type; courseId?; dueAt?; estMinutes?; importance?; notes? }`, `isOpen(task)`, `listTasks(db, options?: { includeDone?; courseId? })`, `getTask(db, id)`, `getTaskByExternalId(db, externalId)`, `createTask(db, input, options?: { now?; source?; externalId? })`, `updateTask(db, id, input, now?)`, `setTaskStatus(db, id, status, now?)`, `postponeTask(db, id, byMs, now?)`, `deleteTask(db, id)`
  - `tests/helpers/db.ts`: `memoryDb(): Db`

- [ ] **Step 1: Write the test helper and the failing test**

`tests/helpers/db.ts`:

```ts
import { openDb, type Db } from "@/db/connection";

export function memoryDb(): Db {
  return openDb(":memory:");
}
```

`tests/db/repos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { COURSE_COLORS, createCourse, deleteCourse, getCourse, listCourses, updateCourse } from "@/db/courses";
import { addMeetingTime, deleteMeetingTimesByExternalPrefix, listMeetingTimes } from "@/db/meetings";
import {
  createTask,
  getTask,
  isOpen,
  listTasks,
  postponeTask,
  setTaskStatus,
  updateTask,
} from "@/db/tasks";
import { currentTerm, listTerms, upsertTerm, type Term } from "@/db/terms";
import { DAY_MS } from "@/lib/time";
import { memoryDb } from "../helpers/db";

const NOW = Date.parse("2026-10-12T04:00:00Z");

describe("courses", () => {
  it("creates courses with defaults and a palette color, sorted by title", () => {
    const db = memoryDb();
    const b = createCourse(db, { title: "beta" }, { now: NOW });
    const a = createCourse(db, { title: "Alpha", code: "X-1", links: ["https://example.edu"] }, { now: NOW });
    expect(b).toMatchObject({ color: COURSE_COLORS[0], source: "manual", aiAllowed: true, links: [] });
    expect(a).toMatchObject({ color: COURSE_COLORS[1], code: "X-1", links: ["https://example.edu"], createdAt: NOW });
    expect(listCourses(db).map((c) => c.title)).toEqual(["Alpha", "beta"]);
  });

  it("updates and deletes courses", () => {
    const db = memoryDb();
    const c = createCourse(db, { title: "Old" }, { now: NOW });
    updateCourse(db, c.id, { title: "New", instructor: "Dr. Demo", color: "#123456" }, NOW + 1);
    expect(getCourse(db, c.id)).toMatchObject({ title: "New", instructor: "Dr. Demo", color: "#123456", updatedAt: NOW + 1 });
    deleteCourse(db, c.id);
    expect(getCourse(db, c.id)).toBeNull();
  });

  it("removes a course's class times and keeps its tasks without a course", () => {
    const db = memoryDb();
    const c = createCourse(db, { title: "Demo" }, { now: NOW });
    addMeetingTime(db, { courseId: c.id, weekday: 2, startMinute: 530, endMinute: 745 });
    const t = createTask(db, { title: "Essay", type: "assignment", courseId: c.id }, { now: NOW });
    deleteCourse(db, c.id);
    expect(listMeetingTimes(db)).toEqual([]);
    expect(getTask(db, t.id)?.courseId).toBeNull();
  });
});

describe("meeting times", () => {
  it("stores weeks and lists by weekday then start", () => {
    const db = memoryDb();
    const c = createCourse(db, { title: "Demo" }, { now: NOW });
    addMeetingTime(db, { courseId: c.id, weekday: 3, startMinute: 600, endMinute: 745, room: "Hall 1" });
    addMeetingTime(db, { courseId: c.id, weekday: 1, startMinute: 805, endMinute: 1020, weeks: [1, 3, 5], externalId: "yjsy:a" });
    const list = listMeetingTimes(db, c.id);
    expect(list.map((m) => m.weekday)).toEqual([1, 3]);
    expect(list[0]).toMatchObject({ weeks: [1, 3, 5], room: null, externalId: "yjsy:a" });
    expect(deleteMeetingTimesByExternalPrefix(db, "yjsy:")).toBe(1);
    expect(listMeetingTimes(db)).toHaveLength(1);
  });
});

describe("terms", () => {
  const term = (id: string, startDate: string): Term => ({
    id,
    name: id,
    startDate,
    weeks: 18,
    periods: [{ period: 1, startMinute: 480, endMinute: 525 }],
  });

  it("inserts and then updates a term by id", () => {
    const db = memoryDb();
    upsertTerm(db, term("t", "2026-09-14"));
    upsertTerm(db, { ...term("t", "2026-09-14"), weeks: 16 });
    expect(listTerms(db)).toEqual([{ ...term("t", "2026-09-14"), weeks: 16 }]);
  });

  it("picks the term that contains now, else the latest started one", () => {
    const spring = term("spring", "2026-02-23");
    const autumn = term("autumn", "2026-09-14");
    expect(currentTerm([spring, autumn], NOW)?.id).toBe("autumn");
    expect(currentTerm([spring], NOW)?.id).toBe("spring");
    expect(currentTerm([], NOW)).toBeNull();
  });
});

describe("tasks", () => {
  it("creates tasks with defaults", () => {
    const db = memoryDb();
    const t = createTask(db, { title: "Read ch. 3", type: "reading" }, { now: NOW });
    expect(t).toMatchObject({ importance: 2, status: "todo", source: "manual", dueAt: null, courseId: null });
    expect(isOpen(t)).toBe(true);
  });

  it("lists open tasks by due date with undated last", () => {
    const db = memoryDb();
    createTask(db, { title: "undated", type: "personal" }, { now: NOW });
    createTask(db, { title: "later", type: "exam", dueAt: NOW + 5 * DAY_MS }, { now: NOW });
    createTask(db, { title: "soon", type: "assignment", dueAt: NOW + DAY_MS }, { now: NOW });
    const done = createTask(db, { title: "done", type: "assignment", dueAt: NOW }, { now: NOW });
    setTaskStatus(db, done.id, "done", NOW);
    expect(listTasks(db).map((t) => t.title)).toEqual(["soon", "later", "undated"]);
    expect(listTasks(db, { includeDone: true }).map((t) => t.title)).toEqual(["done", "soon", "later", "undated"]);
  });

  it("records completion time and clears it on reopen", () => {
    const db = memoryDb();
    const t = createTask(db, { title: "x", type: "assignment" }, { now: NOW });
    setTaskStatus(db, t.id, "done", NOW + 10);
    expect(getTask(db, t.id)).toMatchObject({ status: "done", completedAt: NOW + 10 });
    setTaskStatus(db, t.id, "todo", NOW + 20);
    expect(getTask(db, t.id)).toMatchObject({ status: "todo", completedAt: null });
  });

  it("postpones by moving the due date and marking it postponed", () => {
    const db = memoryDb();
    const dated = createTask(db, { title: "a", type: "assignment", dueAt: NOW }, { now: NOW });
    const undated = createTask(db, { title: "b", type: "assignment" }, { now: NOW });
    postponeTask(db, dated.id, DAY_MS, NOW);
    postponeTask(db, undated.id, DAY_MS, NOW);
    expect(getTask(db, dated.id)).toMatchObject({ dueAt: NOW + DAY_MS, status: "postponed" });
    expect(getTask(db, undated.id)).toMatchObject({ dueAt: NOW + DAY_MS, status: "postponed" });
  });

  it("updates editable fields", () => {
    const db = memoryDb();
    const t = createTask(db, { title: "x", type: "assignment" }, { now: NOW });
    updateTask(db, t.id, { title: "y", type: "presentation", estMinutes: 90, importance: 3, notes: "slides" }, NOW + 1);
    expect(getTask(db, t.id)).toMatchObject({ title: "y", type: "presentation", estMinutes: 90, importance: 3, notes: "slides" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/db/repos.test.ts`
Expected: FAIL with "Failed to resolve import @/db/courses".

- [ ] **Step 3: Implement the four repositories**

`src/db/courses.ts`:

```ts
import { randomUUID } from "node:crypto";
import { all, one, type Db } from "@/db/connection";

export const COURSE_COLORS = ["#2f5d62", "#7a4e2d", "#4b5d8a", "#6b4f7a", "#3f6b45", "#8a5a44", "#5a6b2f", "#2d6a7a"] as const;

export type Course = {
  id: string;
  title: string;
  code: string | null;
  instructor: string | null;
  semester: string | null;
  color: string;
  links: string[];
  notes: string | null;
  aiAllowed: boolean;
  source: "manual" | "zju";
  externalId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CourseInput = {
  title: string;
  code?: string | null;
  instructor?: string | null;
  semester?: string | null;
  color?: string;
  links?: string[];
  notes?: string | null;
};

type CourseRow = {
  id: string;
  title: string;
  code: string | null;
  instructor: string | null;
  semester: string | null;
  color: string;
  links_json: string;
  notes: string | null;
  ai_allowed: number;
  source: "manual" | "zju";
  external_id: string | null;
  created_at: number;
  updated_at: number;
};

function toCourse(r: CourseRow): Course {
  return {
    id: r.id,
    title: r.title,
    code: r.code,
    instructor: r.instructor,
    semester: r.semester,
    color: r.color,
    links: JSON.parse(r.links_json) as string[],
    notes: r.notes,
    aiAllowed: r.ai_allowed === 1,
    source: r.source,
    externalId: r.external_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listCourses(db: Db): Course[] {
  return all<CourseRow>(db, "SELECT * FROM courses ORDER BY title COLLATE NOCASE").map(toCourse);
}

export function getCourse(db: Db, id: string): Course | null {
  const row = one<CourseRow>(db, "SELECT * FROM courses WHERE id = ?", id);
  return row ? toCourse(row) : null;
}

export function getCourseByExternalId(db: Db, externalId: string): Course | null {
  const row = one<CourseRow>(db, "SELECT * FROM courses WHERE external_id = ?", externalId);
  return row ? toCourse(row) : null;
}

type CreateOptions = { now?: number; source?: "manual" | "zju"; externalId?: string | null };

export function createCourse(db: Db, input: CourseInput, options: CreateOptions = {}): Course {
  const now = options.now ?? Date.now();
  const id = randomUUID();
  const count = one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM courses")?.n ?? 0;
  db.prepare(
    `INSERT INTO courses (id, title, code, instructor, semester, color, links_json, notes, source, external_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.title,
    input.code ?? null,
    input.instructor ?? null,
    input.semester ?? null,
    input.color ?? COURSE_COLORS[count % COURSE_COLORS.length],
    JSON.stringify(input.links ?? []),
    input.notes ?? null,
    options.source ?? "manual",
    options.externalId ?? null,
    now,
    now,
  );
  return getCourse(db, id) as Course;
}

export function updateCourse(db: Db, id: string, input: CourseInput, now = Date.now()): Course {
  const existing = getCourse(db, id);
  if (!existing) throw new Error(`No course with id ${id}`);
  db.prepare(
    `UPDATE courses SET title = ?, code = ?, instructor = ?, semester = ?, color = ?, links_json = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.title,
    input.code ?? null,
    input.instructor ?? null,
    input.semester ?? null,
    input.color ?? existing.color,
    JSON.stringify(input.links ?? []),
    input.notes ?? null,
    now,
    id,
  );
  return getCourse(db, id) as Course;
}

export function deleteCourse(db: Db, id: string): void {
  db.prepare("DELETE FROM courses WHERE id = ?").run(id);
}
```

`src/db/meetings.ts`:

```ts
import { randomUUID } from "node:crypto";
import { all, one, type Db } from "@/db/connection";

export type MeetingTime = {
  id: string;
  courseId: string;
  termId: string | null;
  weekday: number;
  startMinute: number;
  endMinute: number;
  room: string | null;
  weeks: number[];
  externalId: string | null;
};

export type MeetingInput = {
  courseId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  termId?: string | null;
  room?: string | null;
  weeks?: number[];
  externalId?: string | null;
};

type MeetingRow = {
  id: string;
  course_id: string;
  term_id: string | null;
  weekday: number;
  start_minute: number;
  end_minute: number;
  room: string | null;
  weeks_json: string;
  external_id: string | null;
};

function toMeeting(r: MeetingRow): MeetingTime {
  return {
    id: r.id,
    courseId: r.course_id,
    termId: r.term_id,
    weekday: r.weekday,
    startMinute: r.start_minute,
    endMinute: r.end_minute,
    room: r.room,
    weeks: JSON.parse(r.weeks_json) as number[],
    externalId: r.external_id,
  };
}

export function listMeetingTimes(db: Db, courseId?: string): MeetingTime[] {
  const order = "ORDER BY weekday, start_minute";
  const rows = courseId
    ? all<MeetingRow>(db, `SELECT * FROM meeting_times WHERE course_id = ? ${order}`, courseId)
    : all<MeetingRow>(db, `SELECT * FROM meeting_times ${order}`);
  return rows.map(toMeeting);
}

export function addMeetingTime(db: Db, input: MeetingInput): MeetingTime {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO meeting_times (id, course_id, term_id, weekday, start_minute, end_minute, room, weeks_json, external_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.courseId,
    input.termId ?? null,
    input.weekday,
    input.startMinute,
    input.endMinute,
    input.room ?? null,
    JSON.stringify(input.weeks ?? []),
    input.externalId ?? null,
  );
  return toMeeting(one<MeetingRow>(db, "SELECT * FROM meeting_times WHERE id = ?", id) as MeetingRow);
}

export function deleteMeetingTime(db: Db, id: string): void {
  db.prepare("DELETE FROM meeting_times WHERE id = ?").run(id);
}

export function deleteMeetingTimesByExternalPrefix(db: Db, prefix: string): number {
  const result = db.prepare("DELETE FROM meeting_times WHERE external_id LIKE ? || '%'").run(prefix);
  return Number(result.changes);
}
```

`src/db/terms.ts`:

```ts
import { all, type Db } from "@/db/connection";
import { DAY_MS, shanghaiToMs } from "@/lib/time";

export type Period = { period: number; startMinute: number; endMinute: number };

export type Term = { id: string; name: string; startDate: string; weeks: number; periods: Period[] };

type TermRow = { id: string; name: string; start_date: string; weeks: number; periods_json: string };

export function upsertTerm(db: Db, term: Term): void {
  db.prepare(
    `INSERT INTO terms (id, name, start_date, weeks, periods_json) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, start_date = excluded.start_date,
       weeks = excluded.weeks, periods_json = excluded.periods_json`,
  ).run(term.id, term.name, term.startDate, term.weeks, JSON.stringify(term.periods));
}

export function listTerms(db: Db): Term[] {
  return all<TermRow>(db, "SELECT * FROM terms ORDER BY start_date").map((r) => ({
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    weeks: r.weeks,
    periods: JSON.parse(r.periods_json) as Period[],
  }));
}

export function currentTerm(terms: Term[], now: number): Term | null {
  const started = terms
    .filter((t) => shanghaiToMs(t.startDate) <= now)
    .sort((a, b) => shanghaiToMs(b.startDate) - shanghaiToMs(a.startDate));
  const running = started.find((t) => now < shanghaiToMs(t.startDate) + t.weeks * 7 * DAY_MS);
  return running ?? started[0] ?? null;
}
```

`src/db/tasks.ts`:

```ts
import { randomUUID } from "node:crypto";
import { all, one, type Db } from "@/db/connection";

export const TASK_TYPES = ["assignment", "reading", "presentation", "exam", "personal", "prep"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ["todo", "doing", "done", "postponed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Importance = 1 | 2 | 3;
export type TaskSource = "manual" | "zju" | "rule";

export type Task = {
  id: string;
  courseId: string | null;
  type: TaskType;
  title: string;
  dueAt: number | null;
  estMinutes: number | null;
  importance: Importance;
  status: TaskStatus;
  notes: string | null;
  source: TaskSource;
  externalId: string | null;
  ruleId: string | null;
  occurrenceKey: string | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type TaskInput = {
  title: string;
  type: TaskType;
  courseId?: string | null;
  dueAt?: number | null;
  estMinutes?: number | null;
  importance?: Importance;
  notes?: string | null;
};

type TaskRow = {
  id: string;
  course_id: string | null;
  type: TaskType;
  title: string;
  due_at: number | null;
  est_minutes: number | null;
  importance: Importance;
  status: TaskStatus;
  notes: string | null;
  source: TaskSource;
  external_id: string | null;
  rule_id: string | null;
  occurrence_key: string | null;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
};

function toTask(r: TaskRow): Task {
  return {
    id: r.id,
    courseId: r.course_id,
    type: r.type,
    title: r.title,
    dueAt: r.due_at,
    estMinutes: r.est_minutes,
    importance: r.importance,
    status: r.status,
    notes: r.notes,
    source: r.source,
    externalId: r.external_id,
    ruleId: r.rule_id,
    occurrenceKey: r.occurrence_key,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function isOpen(task: Pick<Task, "status">): boolean {
  return task.status !== "done";
}

export function listTasks(db: Db, options: { includeDone?: boolean; courseId?: string } = {}): Task[] {
  const where: string[] = [];
  const params: string[] = [];
  if (!options.includeDone) where.push("status != 'done'");
  if (options.courseId) {
    where.push("course_id = ?");
    params.push(options.courseId);
  }
  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return all<TaskRow>(db, `SELECT * FROM tasks ${filter} ORDER BY due_at IS NULL, due_at, created_at`, ...params).map(
    toTask,
  );
}

export function getTask(db: Db, id: string): Task | null {
  const row = one<TaskRow>(db, "SELECT * FROM tasks WHERE id = ?", id);
  return row ? toTask(row) : null;
}

export function getTaskByExternalId(db: Db, externalId: string): Task | null {
  const row = one<TaskRow>(db, "SELECT * FROM tasks WHERE external_id = ?", externalId);
  return row ? toTask(row) : null;
}

type CreateOptions = { now?: number; source?: TaskSource; externalId?: string | null };

export function createTask(db: Db, input: TaskInput, options: CreateOptions = {}): Task {
  const now = options.now ?? Date.now();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO tasks (id, course_id, type, title, due_at, est_minutes, importance, notes, source, external_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.courseId ?? null,
    input.type,
    input.title,
    input.dueAt ?? null,
    input.estMinutes ?? null,
    input.importance ?? 2,
    input.notes ?? null,
    options.source ?? "manual",
    options.externalId ?? null,
    now,
    now,
  );
  return getTask(db, id) as Task;
}

export function updateTask(db: Db, id: string, input: TaskInput, now = Date.now()): Task {
  db.prepare(
    `UPDATE tasks SET title = ?, type = ?, course_id = ?, due_at = ?, est_minutes = ?, importance = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.title,
    input.type,
    input.courseId ?? null,
    input.dueAt ?? null,
    input.estMinutes ?? null,
    input.importance ?? 2,
    input.notes ?? null,
    now,
    id,
  );
  return getTask(db, id) as Task;
}

export function setTaskStatus(db: Db, id: string, status: TaskStatus, now = Date.now()): void {
  db.prepare("UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?").run(
    status,
    status === "done" ? now : null,
    now,
    id,
  );
}

export function postponeTask(db: Db, id: string, byMs: number, now = Date.now()): void {
  db.prepare("UPDATE tasks SET due_at = COALESCE(due_at, ?) + ?, status = 'postponed', updated_at = ? WHERE id = ?").run(
    now,
    byMs,
    now,
    id,
  );
}

export function deleteTask(db: Db, id: string): void {
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/db/repos.test.ts`
Expected: PASS.

- [ ] **Step 5: Run all checks and commit**

Run: `npm run check`
Expected: all PASS.

```bash
git add src/db/courses.ts src/db/meetings.ts src/db/terms.ts src/db/tasks.ts tests/helpers/db.ts tests/db/repos.test.ts
git commit -m "Add repositories for courses, class times, terms and tasks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Class sessions and recurring prep tasks

**Files:**
- Create: `src/lib/sessions.ts`, `src/lib/recurrence.ts`, `src/db/rules.ts`
- Test: `tests/lib/sessions.test.ts`, `tests/db/rules.test.ts`

**Interfaces:**
- Consumes: `MeetingTime` (`@/db/meetings`), `Term` (`@/db/terms`), time helpers (Task 1), `createCourse`, `addMeetingTime`, `listTasks`, `upsertTerm` (Task 3).
- Produces:
  - `@/lib/sessions`: `type ClassSession = { courseId; meetingTimeId; week: number | null; startsAt; endsAt; room: string | null }`, `weekOneMonday(term)`, `teachingWeek(term, ms)`, `sessionsBetween(meetings: MeetingTime[], terms: Term[], fromMs, toMs): ClassSession[]`, `compressWeeks(weeks: number[]): string`, `describeMeeting(m: MeetingTime): string`
  - `@/lib/recurrence`: `PREP_HORIZON_MS` (14 days), `type PrepOccurrence = { occurrenceKey: string; title: string; dueAt: number }`, `prepOccurrences(rule, sessions, now, horizonMs?)`
  - `@/db/rules`: `type RecurrenceRule = { id; courseId; title; leadMinutes; estMinutes: number | null; importance: Importance; active: boolean }`, `type RuleInput = { courseId; title; leadMinutes; estMinutes?; importance? }`, `listRules(db, courseId?)`, `createRule(db, input)`, `deleteRule(db, id)`, `materializePrepTasks(db, now): number`

- [ ] **Step 1: Write the failing tests**

`tests/lib/sessions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { MeetingTime } from "@/db/meetings";
import type { Term } from "@/db/terms";
import { prepOccurrences } from "@/lib/recurrence";
import { compressWeeks, describeMeeting, sessionsBetween, teachingWeek } from "@/lib/sessions";
import { DAY_MS } from "@/lib/time";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-12T04:00:00Z"); // Mon 12 Oct, 12:00 Shanghai (week 5)
const term: Term = { id: "t", name: "T", startDate: "2026-09-14", weeks: 18, periods: [] };

const meeting = (overrides: Partial<MeetingTime>): MeetingTime => ({
  id: "m1",
  courseId: "c1",
  termId: "t",
  weekday: 2,
  startMinute: 530,
  endMinute: 745,
  room: "Hall 1",
  weeks: [1, 3, 5, 7],
  externalId: null,
  ...overrides,
});

describe("teachingWeek", () => {
  it("counts weeks from the Monday of the term's first week", () => {
    expect(teachingWeek(term, NOW)).toBe(5);
    expect(teachingWeek({ startDate: "2026-09-16" }, NOW)).toBe(5);
  });
});

describe("sessionsBetween", () => {
  it("places sessions on the right dates and only in listed weeks", () => {
    const list = sessionsBetween([meeting({})], [term], NOW, NOW + 14 * DAY_MS);
    expect(list).toEqual([
      {
        courseId: "c1",
        meetingTimeId: "m1",
        week: 5,
        startsAt: at("2026-10-13T00:50:00Z"),
        endsAt: at("2026-10-13T04:25:00Z"),
        room: "Hall 1",
      },
    ]);
  });

  it("uses every week of the term when no weeks are listed", () => {
    const list = sessionsBetween([meeting({ weeks: [] })], [term], NOW, NOW + 14 * DAY_MS);
    expect(list.map((s) => s.week)).toEqual([5, 6]);
  });

  it("repeats a class time without a term every week", () => {
    const list = sessionsBetween([meeting({ termId: null, weeks: [] })], [term], NOW, NOW + 14 * DAY_MS);
    expect(list.map((s) => s.startsAt)).toEqual([at("2026-10-13T00:50:00Z"), at("2026-10-20T00:50:00Z")]);
    expect(list[0].week).toBeNull();
  });

  it("sorts sessions from several class times by start", () => {
    const list = sessionsBetween(
      [meeting({ id: "a", weekday: 3, weeks: [5] }), meeting({ id: "b", weekday: 1, startMinute: 900, endMinute: 960, weeks: [6] })],
      [term],
      NOW,
      NOW + 14 * DAY_MS,
    );
    expect(list.map((s) => s.meetingTimeId)).toEqual(["a", "b"]);
  });
});

describe("describing class times", () => {
  it("compresses week lists into ranges", () => {
    expect(compressWeeks([1, 2, 3, 5, 6, 7, 8])).toBe("1–3, 5–8");
    expect(compressWeeks([1, 3, 5, 7])).toBe("1, 3, 5, 7");
    expect(compressWeeks([4])).toBe("4");
    expect(compressWeeks([])).toBe("");
  });

  it("describes a class time in one line", () => {
    expect(describeMeeting(meeting({}))).toBe("Tue 8:50–12:25 · Hall 1 · weeks 1, 3, 5, 7");
    expect(describeMeeting(meeting({ room: null, weeks: [] }))).toBe("Tue 8:50–12:25");
  });
});

describe("prepOccurrences", () => {
  it("creates one prep task per upcoming class, due a set time before it", () => {
    const sessions = sessionsBetween([meeting({ weeks: [5, 6, 7] })], [term], NOW, NOW + 30 * DAY_MS);
    const list = prepOccurrences({ courseId: "c1", title: "Prepare for class", leadMinutes: 12 * 60 }, sessions, NOW);
    expect(list).toEqual([
      { occurrenceKey: String(at("2026-10-13T00:50:00Z")), title: "Prepare for class · Tue 13 Oct", dueAt: at("2026-10-12T12:50:00Z") },
      { occurrenceKey: String(at("2026-10-20T00:50:00Z")), title: "Prepare for class · Tue 20 Oct", dueAt: at("2026-10-19T12:50:00Z") },
    ]);
  });

  it("ignores other courses and classes that already started", () => {
    const sessions = sessionsBetween([meeting({ weeks: [5] })], [term], NOW - 7 * DAY_MS, NOW + 7 * DAY_MS);
    expect(prepOccurrences({ courseId: "other", title: "x", leadMinutes: 60 }, sessions, NOW)).toEqual([]);
    expect(prepOccurrences({ courseId: "c1", title: "x", leadMinutes: 60 }, sessions, at("2026-10-13T02:00:00Z"))).toEqual([]);
  });
});
```

`tests/db/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCourse } from "@/db/courses";
import { addMeetingTime } from "@/db/meetings";
import { createRule, deleteRule, listRules, materializePrepTasks } from "@/db/rules";
import { listTasks } from "@/db/tasks";
import { upsertTerm } from "@/db/terms";
import { memoryDb } from "../helpers/db";

const NOW = Date.parse("2026-10-12T04:00:00Z");

function setup() {
  const db = memoryDb();
  upsertTerm(db, { id: "t", name: "T", startDate: "2026-09-14", weeks: 18, periods: [] });
  const course = createCourse(db, { title: "Demo" }, { now: NOW });
  addMeetingTime(db, { courseId: course.id, termId: "t", weekday: 2, startMinute: 530, endMinute: 745, weeks: [5, 6, 7] });
  return { db, course };
}

describe("recurrence rules", () => {
  it("creates prep tasks for the next two weeks of classes, once", () => {
    const { db, course } = setup();
    createRule(db, { courseId: course.id, title: "Prepare for class", leadMinutes: 720, estMinutes: 45 });
    expect(materializePrepTasks(db, NOW)).toBe(2);
    expect(materializePrepTasks(db, NOW)).toBe(0);
    const tasks = listTasks(db);
    expect(tasks.map((t) => [t.type, t.source, t.estMinutes, t.courseId])).toEqual([
      ["prep", "rule", 45, course.id],
      ["prep", "rule", 45, course.id],
    ]);
    expect(tasks[0].dueAt).toBe(Date.parse("2026-10-12T12:50:00Z"));
  });

  it("does nothing without active rules", () => {
    const { db } = setup();
    expect(materializePrepTasks(db, NOW)).toBe(0);
  });

  it("keeps past prep tasks when a rule is deleted", () => {
    const { db, course } = setup();
    const rule = createRule(db, { courseId: course.id, title: "Prep", leadMinutes: 60 });
    materializePrepTasks(db, NOW);
    expect(listRules(db, course.id)).toHaveLength(1);
    deleteRule(db, rule.id);
    expect(listRules(db)).toEqual([]);
    expect(listTasks(db).every((t) => t.ruleId === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/lib/sessions.test.ts tests/db/rules.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/recurrence" / "@/db/rules".

- [ ] **Step 3: Implement**

`src/lib/sessions.ts`:

```ts
import type { MeetingTime } from "@/db/meetings";
import type { Term } from "@/db/terms";
import { DAY_MS, MINUTE_MS, formatClock, shanghaiToMs, startOfShanghaiWeek, weekdayName } from "@/lib/time";

const WEEK_MS = 7 * DAY_MS;

export type ClassSession = {
  courseId: string;
  meetingTimeId: string;
  week: number | null;
  startsAt: number;
  endsAt: number;
  room: string | null;
};

export function weekOneMonday(term: Pick<Term, "startDate">): number {
  return startOfShanghaiWeek(shanghaiToMs(term.startDate));
}

export function teachingWeek(term: Pick<Term, "startDate">, ms: number): number {
  return Math.floor((ms - weekOneMonday(term)) / WEEK_MS) + 1;
}

export function sessionsBetween(meetings: MeetingTime[], terms: Term[], fromMs: number, toMs: number): ClassSession[] {
  const termById = new Map(terms.map((t) => [t.id, t]));
  const out: ClassSession[] = [];
  const push = (m: MeetingTime, monday: number, week: number | null) => {
    const day = monday + (m.weekday - 1) * DAY_MS;
    const startsAt = day + m.startMinute * MINUTE_MS;
    if (startsAt < fromMs || startsAt >= toMs) return;
    out.push({ courseId: m.courseId, meetingTimeId: m.id, week, startsAt, endsAt: day + m.endMinute * MINUTE_MS, room: m.room });
  };

  for (const m of meetings) {
    const term = m.termId ? termById.get(m.termId) : undefined;
    if (term) {
      const first = weekOneMonday(term);
      const weeks = m.weeks.length ? m.weeks : Array.from({ length: term.weeks }, (_, i) => i + 1);
      for (const week of weeks) push(m, first + (week - 1) * WEEK_MS, week);
    } else {
      for (let monday = startOfShanghaiWeek(fromMs); monday < toMs; monday += WEEK_MS) push(m, monday, null);
    }
  }
  return out.sort((a, b) => a.startsAt - b.startsAt);
}

export function compressWeeks(weeks: number[]): string {
  const sorted = [...new Set(weeks)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j - i >= 2 ? `${sorted[i]}–${sorted[j]}` : sorted.slice(i, j + 1).join(", "));
    i = j + 1;
  }
  return parts.join(", ");
}

export function describeMeeting(m: MeetingTime): string {
  const parts = [`${weekdayName(m.weekday)} ${formatClock(m.startMinute)}–${formatClock(m.endMinute)}`];
  if (m.room) parts.push(m.room);
  if (m.weeks.length) parts.push(`weeks ${compressWeeks(m.weeks)}`);
  return parts.join(" · ");
}
```

`src/lib/recurrence.ts`:

```ts
import type { ClassSession } from "@/lib/sessions";
import { DAY_MS, MINUTE_MS, formatDate } from "@/lib/time";

export const PREP_HORIZON_MS = 14 * DAY_MS;

export type PrepOccurrence = { occurrenceKey: string; title: string; dueAt: number };

type RuleShape = { courseId: string; title: string; leadMinutes: number };

export function prepOccurrences(
  rule: RuleShape,
  sessions: ClassSession[],
  now: number,
  horizonMs = PREP_HORIZON_MS,
): PrepOccurrence[] {
  return sessions
    .filter((s) => s.courseId === rule.courseId && s.startsAt > now && s.startsAt <= now + horizonMs)
    .map((s) => ({
      occurrenceKey: String(s.startsAt),
      title: `${rule.title} · ${formatDate(s.startsAt)}`,
      dueAt: s.startsAt - rule.leadMinutes * MINUTE_MS,
    }));
}
```

`src/db/rules.ts`:

```ts
import { randomUUID } from "node:crypto";
import { all, one, type Db } from "@/db/connection";
import { listMeetingTimes } from "@/db/meetings";
import type { Importance } from "@/db/tasks";
import { listTerms } from "@/db/terms";
import { PREP_HORIZON_MS, prepOccurrences } from "@/lib/recurrence";
import { sessionsBetween } from "@/lib/sessions";

export type RecurrenceRule = {
  id: string;
  courseId: string;
  title: string;
  leadMinutes: number;
  estMinutes: number | null;
  importance: Importance;
  active: boolean;
};

export type RuleInput = { courseId: string; title: string; leadMinutes: number; estMinutes?: number | null; importance?: Importance };

type RuleRow = {
  id: string;
  course_id: string;
  title: string;
  lead_minutes: number;
  est_minutes: number | null;
  importance: Importance;
  active: number;
};

function toRule(r: RuleRow): RecurrenceRule {
  return {
    id: r.id,
    courseId: r.course_id,
    title: r.title,
    leadMinutes: r.lead_minutes,
    estMinutes: r.est_minutes,
    importance: r.importance,
    active: r.active === 1,
  };
}

export function listRules(db: Db, courseId?: string): RecurrenceRule[] {
  const rows = courseId
    ? all<RuleRow>(db, "SELECT * FROM recurrence_rules WHERE course_id = ? ORDER BY title", courseId)
    : all<RuleRow>(db, "SELECT * FROM recurrence_rules ORDER BY title");
  return rows.map(toRule);
}

export function createRule(db: Db, input: RuleInput): RecurrenceRule {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO recurrence_rules (id, course_id, title, lead_minutes, est_minutes, importance) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, input.courseId, input.title, input.leadMinutes, input.estMinutes ?? null, input.importance ?? 2);
  return toRule(one<RuleRow>(db, "SELECT * FROM recurrence_rules WHERE id = ?", id) as RuleRow);
}

export function deleteRule(db: Db, id: string): void {
  db.prepare("DELETE FROM recurrence_rules WHERE id = ?").run(id);
}

// Creates prep tasks for classes in the next two weeks. Safe to call on every page load:
// UNIQUE (rule_id, occurrence_key) makes repeats a no-op.
export function materializePrepTasks(db: Db, now: number): number {
  const rules = listRules(db).filter((r) => r.active);
  if (!rules.length) return 0;
  const sessions = sessionsBetween(listMeetingTimes(db), listTerms(db), now, now + PREP_HORIZON_MS);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO tasks (id, course_id, type, title, due_at, est_minutes, importance, status, source, rule_id, occurrence_key, created_at, updated_at)
     VALUES (?, ?, 'prep', ?, ?, ?, ?, 'todo', 'rule', ?, ?, ?, ?)`,
  );
  let added = 0;
  for (const rule of rules) {
    for (const occurrence of prepOccurrences(rule, sessions, now)) {
      const result = insert.run(
        randomUUID(),
        rule.courseId,
        occurrence.title,
        occurrence.dueAt,
        rule.estMinutes,
        rule.importance,
        rule.id,
        occurrence.occurrenceKey,
        now,
        now,
      );
      added += Number(result.changes);
    }
  }
  return added;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/lib/sessions.test.ts tests/db/rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Run all checks and commit**

Run: `npm run check`
Expected: all PASS.

```bash
git add src/lib/sessions.ts src/lib/recurrence.ts src/db/rules.ts tests/lib/sessions.test.ts tests/db/rules.test.ts
git commit -m "Add class sessions and recurring prep tasks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Priority, workload and deadline groups

**Files:**
- Create: `src/lib/priority.ts`, `src/lib/workload.ts`, `src/lib/deadline-groups.ts`
- Create: `tests/helpers/task.ts`
- Test: `tests/lib/priority.test.ts`, `tests/lib/workload.test.ts`

**Interfaces:**
- Consumes: `Task`, `isOpen` (Task 3), time helpers (Task 1).
- Produces:
  - `@/lib/priority`: `type ScoredTask = { task: Task; score: number; reasons: string[] }`, `scoreTask(task, now): ScoredTask | null` (null for done), `rankTasks(tasks, now): ScoredTask[]` (best first)
  - `@/lib/workload`: `type WeekLoad = { weekStart; minutes; tasks; unestimated }`, `weeklyWorkload(tasks, now, weeks = 4): WeekLoad[]`, `describeLoad(week: WeekLoad): string`
  - `@/lib/deadline-groups`: `type TaskGroups = { overdue; thisWeek; later; noDate; doneRecently }` (each `Task[]`), `groupTasks(tasks, now): TaskGroups`
  - `tests/helpers/task.ts`: `makeTask(overrides?: Partial<Task>): Task`

Scoring rules (keep them in this order; the tests pin the outcomes, not the constants):
- Done → not scored.
- No due date → `importance × 5`, reason "No deadline".
- Overdue → `100 + importance × 10`, reason "Overdue by …".
- Otherwise → `40 / (daysLeft + 1) + importance × 8`, reason "Due …"; if an estimate exists and fewer than 3 days are left, add `min(hours, 4) × 4`, reason "Needs about …".
- Importance 3 adds the reason "Marked important".
- Ties go to the earlier due date.

- [ ] **Step 1: Write the helper and the failing tests**

`tests/helpers/task.ts`:

```ts
import type { Task } from "@/db/tasks";

let counter = 0;

export function makeTask(overrides: Partial<Task> = {}): Task {
  counter += 1;
  return {
    id: `task-${counter}`,
    courseId: null,
    type: "assignment",
    title: `Task ${counter}`,
    dueAt: null,
    estMinutes: null,
    importance: 2,
    status: "todo",
    notes: null,
    source: "manual",
    externalId: null,
    ruleId: null,
    occurrenceKey: null,
    completedAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}
```

`tests/lib/priority.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rankTasks, scoreTask } from "@/lib/priority";
import { DAY_MS, HOUR_MS } from "@/lib/time";
import { makeTask } from "../helpers/task";

const NOW = Date.parse("2026-10-12T04:00:00Z"); // Mon 12:00 Shanghai
const TONIGHT = Date.parse("2026-10-12T15:59:00Z"); // Mon 23:59 Shanghai

describe("scoreTask", () => {
  it("does not score finished tasks", () => {
    expect(scoreTask(makeTask({ status: "done", dueAt: TONIGHT }), NOW)).toBeNull();
  });

  it("explains each score in plain words", () => {
    expect(scoreTask(makeTask({ dueAt: NOW - 2 * DAY_MS }), NOW)?.reasons).toEqual(["Overdue by 2 days"]);
    expect(scoreTask(makeTask({ dueAt: TONIGHT, estMinutes: 180, importance: 3 }), NOW)?.reasons).toEqual([
      "Due today 23:59",
      "Needs about 3 hours",
      "Marked important",
    ]);
    expect(scoreTask(makeTask({}), NOW)?.reasons).toEqual(["No deadline"]);
  });

  it("only mentions effort when the deadline is close", () => {
    expect(scoreTask(makeTask({ dueAt: NOW + 10 * DAY_MS, estMinutes: 180 }), NOW)?.reasons).toEqual(["Due Thu 22 Oct, 12:00"]);
  });
});

describe("rankTasks", () => {
  it("puts overdue work above everything else", () => {
    const overdue = makeTask({ dueAt: NOW - HOUR_MS, importance: 1 });
    const urgent = makeTask({ dueAt: TONIGHT, importance: 3, estMinutes: 240 });
    expect(rankTasks([urgent, overdue], NOW)[0].task).toBe(overdue);
  });

  it("prefers sooner deadlines at the same importance", () => {
    const soon = makeTask({ dueAt: TONIGHT });
    const later = makeTask({ dueAt: NOW + 7 * DAY_MS });
    expect(rankTasks([later, soon], NOW).map((s) => s.task)).toEqual([soon, later]);
  });

  it("prefers important work at the same deadline", () => {
    const high = makeTask({ dueAt: NOW + 7 * DAY_MS, importance: 3 });
    const low = makeTask({ dueAt: NOW + 7 * DAY_MS, importance: 1 });
    expect(rankTasks([low, high], NOW).map((s) => s.task)).toEqual([high, low]);
  });

  it("ranks undated tasks below tasks due soon", () => {
    const undated = makeTask({ importance: 2 });
    const tomorrow = makeTask({ dueAt: NOW + DAY_MS, importance: 1 });
    expect(rankTasks([undated, tomorrow], NOW).map((s) => s.task)).toEqual([tomorrow, undated]);
  });

  it("leaves done tasks out", () => {
    expect(rankTasks([makeTask({ status: "done" })], NOW)).toEqual([]);
  });
});
```

`tests/lib/workload.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { groupTasks } from "@/lib/deadline-groups";
import { DAY_MS } from "@/lib/time";
import { describeLoad, weeklyWorkload } from "@/lib/workload";
import { makeTask } from "../helpers/task";

const NOW = Date.parse("2026-10-12T04:00:00Z"); // Mon 12 Oct, 12:00 Shanghai
const WEEK_START = Date.parse("2026-10-11T16:00:00Z"); // Mon 12 Oct, 00:00 Shanghai

describe("weeklyWorkload", () => {
  it("adds up estimates per Shanghai week and counts overdue work in this week", () => {
    const weeks = weeklyWorkload(
      [
        makeTask({ dueAt: NOW - 3 * DAY_MS, estMinutes: 60 }),
        makeTask({ dueAt: NOW + DAY_MS, estMinutes: 90 }),
        makeTask({ dueAt: NOW + 2 * DAY_MS }),
        makeTask({ dueAt: NOW + 8 * DAY_MS, estMinutes: 30 }),
        makeTask({ dueAt: NOW + DAY_MS, estMinutes: 500, status: "done" }),
        makeTask({ dueAt: NOW + 60 * DAY_MS, estMinutes: 30 }),
        makeTask({ estMinutes: 30 }),
      ],
      NOW,
      3,
    );
    expect(weeks).toEqual([
      { weekStart: WEEK_START, minutes: 150, tasks: 3, unestimated: 1 },
      { weekStart: WEEK_START + 7 * DAY_MS, minutes: 30, tasks: 1, unestimated: 0 },
      { weekStart: WEEK_START + 14 * DAY_MS, minutes: 0, tasks: 0, unestimated: 0 },
    ]);
  });

  it("describes a week in plain words", () => {
    expect(describeLoad({ weekStart: 0, minutes: 0, tasks: 0, unestimated: 0 })).toBe("No tasks");
    expect(describeLoad({ weekStart: 0, minutes: 210, tasks: 4, unestimated: 1 })).toBe("3 h 30 min · 4 tasks · 1 without estimate");
    expect(describeLoad({ weekStart: 0, minutes: 0, tasks: 1, unestimated: 1 })).toBe("1 task · 1 without estimate");
  });
});

describe("groupTasks", () => {
  it("sorts open tasks into overdue, this week, later and no date", () => {
    const overdue = makeTask({ dueAt: NOW - DAY_MS });
    const sunday = makeTask({ dueAt: Date.parse("2026-10-18T15:00:00Z") });
    const nextMonday = makeTask({ dueAt: Date.parse("2026-10-18T16:30:00Z") });
    const undated = makeTask({});
    const doneToday = makeTask({ status: "done", completedAt: NOW - DAY_MS });
    const doneLongAgo = makeTask({ status: "done", completedAt: NOW - 30 * DAY_MS });
    const groups = groupTasks([nextMonday, undated, sunday, overdue, doneToday, doneLongAgo], NOW);
    expect(groups).toEqual({
      overdue: [overdue],
      thisWeek: [sunday],
      later: [nextMonday],
      noDate: [undated],
      doneRecently: [doneToday],
    });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/lib/priority.test.ts tests/lib/workload.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/priority" / "@/lib/deadline-groups".

- [ ] **Step 3: Implement**

`src/lib/priority.ts`:

```ts
import { isOpen, type Task } from "@/db/tasks";
import { DAY_MS, MINUTE_MS, formatDue, humanDuration } from "@/lib/time";

export type ScoredTask = { task: Task; score: number; reasons: string[] };

function dueReason(dueAt: number, now: number): string {
  return `Due ${formatDue(dueAt, now).replace(/^(Today|Tomorrow|Yesterday)/, (word) => word.toLowerCase())}`;
}

export function scoreTask(task: Task, now: number): ScoredTask | null {
  if (!isOpen(task)) return null;
  const reasons: string[] = [];
  let score: number;

  if (task.dueAt === null) {
    score = task.importance * 5;
    reasons.push("No deadline");
  } else if (task.dueAt < now) {
    score = 100 + task.importance * 10;
    reasons.push(`Overdue by ${humanDuration(now - task.dueAt)}`);
  } else {
    const daysLeft = (task.dueAt - now) / DAY_MS;
    score = 40 / (daysLeft + 1) + task.importance * 8;
    reasons.push(dueReason(task.dueAt, now));
    if (task.estMinutes !== null && daysLeft < 3) {
      score += Math.min(task.estMinutes / 60, 4) * 4;
      reasons.push(`Needs about ${humanDuration(task.estMinutes * MINUTE_MS)}`);
    }
  }

  if (task.importance === 3) reasons.push("Marked important");
  return { task, score, reasons };
}

export function rankTasks(tasks: Task[], now: number): ScoredTask[] {
  return tasks
    .map((task) => scoreTask(task, now))
    .filter((scored): scored is ScoredTask => scored !== null)
    .sort((a, b) => b.score - a.score || (a.task.dueAt ?? Infinity) - (b.task.dueAt ?? Infinity));
}
```

`src/lib/workload.ts`:

```ts
import { isOpen, type Task } from "@/db/tasks";
import { DAY_MS, formatMinutes, startOfShanghaiWeek } from "@/lib/time";

export type WeekLoad = { weekStart: number; minutes: number; tasks: number; unestimated: number };

export function weeklyWorkload(tasks: Task[], now: number, weeks = 4): WeekLoad[] {
  const first = startOfShanghaiWeek(now);
  const out: WeekLoad[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: first + i * 7 * DAY_MS,
    minutes: 0,
    tasks: 0,
    unestimated: 0,
  }));
  for (const task of tasks) {
    if (!isOpen(task) || task.dueAt === null) continue;
    // Overdue work still has to be done, so it counts toward this week.
    const index = task.dueAt < first ? 0 : Math.floor((task.dueAt - first) / (7 * DAY_MS));
    const week = out[index];
    if (!week) continue;
    week.tasks += 1;
    if (task.estMinutes === null) week.unestimated += 1;
    else week.minutes += task.estMinutes;
  }
  return out;
}

export function describeLoad(week: WeekLoad): string {
  if (week.tasks === 0) return "No tasks";
  const parts: string[] = [];
  if (week.minutes > 0) parts.push(formatMinutes(week.minutes));
  parts.push(`${week.tasks} ${week.tasks === 1 ? "task" : "tasks"}`);
  if (week.unestimated > 0) parts.push(`${week.unestimated} without estimate`);
  return parts.join(" · ");
}
```

`src/lib/deadline-groups.ts`:

```ts
import { isOpen, type Task } from "@/db/tasks";
import { DAY_MS, startOfShanghaiWeek } from "@/lib/time";

export type TaskGroups = {
  overdue: Task[];
  thisWeek: Task[];
  later: Task[];
  noDate: Task[];
  doneRecently: Task[];
};

const byDue = (a: Task, b: Task) => (a.dueAt ?? 0) - (b.dueAt ?? 0);

export function groupTasks(tasks: Task[], now: number): TaskGroups {
  const weekEnd = startOfShanghaiWeek(now) + 7 * DAY_MS;
  const groups: TaskGroups = { overdue: [], thisWeek: [], later: [], noDate: [], doneRecently: [] };
  for (const task of tasks) {
    if (!isOpen(task)) {
      if (task.completedAt !== null && task.completedAt >= now - 7 * DAY_MS) groups.doneRecently.push(task);
    } else if (task.dueAt === null) {
      groups.noDate.push(task);
    } else if (task.dueAt < now) {
      groups.overdue.push(task);
    } else if (task.dueAt < weekEnd) {
      groups.thisWeek.push(task);
    } else {
      groups.later.push(task);
    }
  }
  groups.overdue.sort(byDue);
  groups.thisWeek.sort(byDue);
  groups.later.sort(byDue);
  groups.doneRecently.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  return groups;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/lib/priority.test.ts tests/lib/workload.test.ts`
Expected: PASS.

- [ ] **Step 5: Run all checks and commit**

Run: `npm run check`
Expected: all PASS.

```bash
git add src/lib/priority.ts src/lib/workload.ts src/lib/deadline-groups.ts tests/helpers/task.ts tests/lib/priority.test.ts tests/lib/workload.test.ts
git commit -m "Add explained priority, weekly workload and deadline groups" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Map ZJU snapshots to courses, class times and tasks

**Files:**
- Install: `zod@4.6.6`
- Create: `src/import/schemas.ts`, `src/import/tronclass.ts`, `src/import/yjsy.ts`
- Create: `sample-data/courses-zju-sample.json`, `sample-data/timetable-yjsy-sample.json` (fake data only)
- Modify: `tests/gitignore.test.ts` (keep-list)
- Test: `tests/import/mapping.test.ts`

**Interfaces:**
- Consumes: `TaskType` (Task 3), `hhmmToMinutes` (Task 1), `Term`/`Period` (Task 3).
- Produces (all pure):
  - `@/import/schemas`: `tronclassSnapshotSchema`, `type TronclassSnapshot`, `yjsySnapshotSchema`, `type YjsySnapshot`
  - `@/import/tronclass`: `NOT_ON_TODO_NOTE`, `classNoFromCode(code: string | null): string | null`, `type ImportedCourse = { externalId; title; code; instructor; semester; classNo }`, `type ImportedTask = { externalId; courseExternalId; type: "assignment" | "exam"; title; dueAt; notes }`, `mapTronclass(snapshot, now): { courses: ImportedCourse[]; tasks: ImportedTask[]; skippedPast: number }`
  - `@/import/yjsy`: `parseWeeks(value: string): number[]`, `type ImportedMeeting = { externalId; classNo; courseTitle; teacher; weekday; startMinute; endMinute; room; weeks }`, `type ImportedNoticeCourse = { classNo; title; teacher; note }`, `mapYjsy(snapshot): { term: Term; meetings: ImportedMeeting[]; noticeCourses: ImportedNoticeCourse[]; skipped: number }`

Mapping rules (from `docs/data-sources.md`):
- TronClass homework, forums with a deadline, and exams become tasks. Homework and forums are `assignment`; forum titles get a `Forum: ` prefix. Exams are `exam`.
- An item on the ZJU to-do list is imported as-is. An item that is not on the to-do list but still due in the future gets the note `NOT_ON_TODO_NOTE`. An item that is not on the to-do list and already past is skipped (counted in `skippedPast`), so old, finished work does not flood "Overdue".
- Class number: the last `-` segment of a TronClass course code when it is all digits. It joins TronClass courses to timetable rows.
- Timetable periods are converted to minutes through the term calendar. Rows with an unknown period are skipped (counted).

- [ ] **Step 1: Install Zod**

```bash
npm install zod@4.6.6
```

- [ ] **Step 2: Add the fake sample snapshots**

`sample-data/courses-zju-sample.json`:

```json
{
  "source": "courses.zju.edu.cn (TronClass) — FAKE SAMPLE DATA",
  "fetched_at": "2026-10-12T04:00:00.000Z",
  "todos": [
    { "id": 910001, "type": "homework", "title": "Essay 1", "course_id": 900001, "course_name": "Demo Strategy", "end_time": "2026-10-20T15:59:00Z" },
    { "id": 920001, "type": "exam", "title": "Quiz 1", "course_id": 900001, "course_name": "Demo Strategy", "end_time": "2026-10-15T14:00:00Z" },
    { "id": 910010, "type": "homework", "title": "Characters L2", "course_id": 900002, "course_name": "Demo Chinese", "end_time": "2026-10-14T04:00:00Z" }
  ],
  "courses": [
    {
      "id": 900001,
      "name": "Demo Strategy",
      "code": "2026-13-9000001001",
      "credit": null,
      "department": "Demo School",
      "semester": "2026-2027 Autumn",
      "academic_year": "2026-2027",
      "start_date": "2026-09-14",
      "end_date": null,
      "instructors": ["Dr. Demo"],
      "activities": [
        { "id": 910001, "type": "homework", "title": "Essay 1", "start_time": null, "end_time": "2026-10-20T15:59:00Z", "is_closed": false, "published": true, "module_id": 1, "uploads": [] },
        { "id": 910002, "type": "homework", "title": "Old task", "start_time": null, "end_time": "2026-09-20T15:59:00Z", "is_closed": true, "published": true, "module_id": 1, "uploads": [] },
        { "id": 910003, "type": "material", "title": "Lecture 1", "start_time": null, "end_time": null, "is_closed": false, "published": true, "module_id": 1, "uploads": [{ "id": 930001, "name": "Lecture 1.pdf", "size": 1000, "type": "document" }] },
        { "id": 910004, "type": "forum", "title": "Discussion week 5", "start_time": null, "end_time": "2026-10-14T05:00:00Z", "is_closed": false, "published": true, "module_id": 1, "uploads": [] }
      ],
      "exams": [
        { "id": 920001, "type": "exam", "title": "Quiz 1", "start_time": "2026-10-10T05:00:00Z", "end_time": "2026-10-15T14:00:00Z", "is_closed": false }
      ]
    },
    {
      "id": 900002,
      "name": "Demo Chinese",
      "code": "2026-16-9000002007",
      "credit": null,
      "department": "Demo College",
      "semester": "2026-2027 Autumn-Winter",
      "academic_year": "2026-2027",
      "start_date": "2026-09-21",
      "end_date": null,
      "instructors": ["Ms. Sample", "Mr. Example"],
      "activities": [
        { "id": 910010, "type": "homework", "title": "Characters L2", "start_time": null, "end_time": "2026-10-14T04:00:00Z", "is_closed": false, "published": true, "module_id": 2, "uploads": [] }
      ],
      "exams": []
    }
  ]
}
```

`sample-data/timetable-yjsy-sample.json`:

```json
{
  "source": "yjsy.zju.edu.cn — FAKE SAMPLE DATA",
  "fetched_at": "2026-10-12T04:00:00.000Z",
  "calendar": {
    "year": "2026",
    "term_code": "12",
    "start": "2026-09-14",
    "end": "2027-01-15",
    "weeks": 18,
    "teaching_weeks": 16,
    "exam_weeks": 2,
    "periods": [
      { "period": 1, "start": 800, "end": 845, "part": "1" },
      { "period": 2, "start": 850, "end": 935, "part": "1" },
      { "period": 3, "start": 1000, "end": 1045, "part": "1" },
      { "period": 4, "start": 1050, "end": 1135, "part": "1" },
      { "period": 5, "start": 1140, "end": 1225, "part": "1" },
      { "period": 6, "start": 1325, "end": 1400, "part": "3" },
      { "period": 7, "start": 1415, "end": 1500, "part": "3" },
      { "period": 8, "start": 1505, "end": 1550, "part": "3" }
    ]
  },
  "classes": [
    { "course": "Demo Strategy", "class_no": "9000001001", "teacher": "Dr. Demo", "weekday": 2, "start_period": 2, "end_period": 5, "weeks": "1,3,5,7", "term": "Autumn", "campus": "Demo Campus", "building": "Demo Hall", "room": "Demo Hall 101" },
    { "course": "Demo Chinese", "class_no": "9000002007", "teacher": "Ms. Sample", "weekday": 3, "start_period": 3, "end_period": 5, "weeks": "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16", "term": "Autumn-Winter", "campus": "Demo Campus", "building": "Demo Hall", "room": "Demo Hall 202" },
    { "course": "Demo Seminar", "class_no": "9000003001", "teacher": "Prof. Placeholder", "weekday": 4, "start_period": 6, "end_period": 8, "weeks": "1,2,3", "term": "Autumn", "campus": null, "building": "Demo Building", "room": null },
    { "course": "Broken Row", "class_no": "9000009001", "teacher": null, "weekday": 5, "start_period": 9, "end_period": 10, "weeks": "1", "term": "Autumn", "campus": null, "building": null, "room": null }
  ],
  "notices": [
    { "course": "Demo Workshop", "course_code": null, "class_no": "9000004001", "college": "Demo School", "teacher": "Visiting expert", "credit": null, "hours": null, "term": null, "note": "Room C1 (23 Oct in B2)", "time_place": "1", "status": "Studying" }
  ]
}
```

In `tests/gitignore.test.ts`, add these two lines to the `MUST_KEEP` list, after `"docs/PRIVACY.md",`:

```ts
  "sample-data/courses-zju-sample.json",
  "sample-data/timetable-yjsy-sample.json",
```

- [ ] **Step 3: Write the failing test**

`tests/import/mapping.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tronclassSnapshotSchema, yjsySnapshotSchema } from "@/import/schemas";
import { NOT_ON_TODO_NOTE, classNoFromCode, mapTronclass } from "@/import/tronclass";
import { mapYjsy, parseWeeks } from "@/import/yjsy";

const NOW = Date.parse("2026-10-12T04:00:00Z");
const load = (name: string) => JSON.parse(readFileSync(`sample-data/${name}`, "utf8")) as unknown;
const tronclass = () => tronclassSnapshotSchema.parse(load("courses-zju-sample.json"));
const yjsy = () => yjsySnapshotSchema.parse(load("timetable-yjsy-sample.json"));

describe("classNoFromCode", () => {
  it("takes the last all-digit segment of a course code", () => {
    expect(classNoFromCode("2026-13-9000001001")).toBe("9000001001");
    expect(classNoFromCode("9000003001")).toBe("9000003001");
    expect(classNoFromCode("ABC-1x")).toBeNull();
    expect(classNoFromCode(null)).toBeNull();
  });
});

describe("mapTronclass", () => {
  it("maps courses with their class numbers and instructors", () => {
    const { courses } = mapTronclass(tronclass(), NOW);
    expect(courses).toEqual([
      { externalId: "tc:course:900001", title: "Demo Strategy", code: "2026-13-9000001001", instructor: "Dr. Demo", semester: "2026-2027 Autumn", classNo: "9000001001" },
      {
        externalId: "tc:course:900002",
        title: "Demo Chinese",
        code: "2026-16-9000002007",
        instructor: "Ms. Sample, Mr. Example",
        semester: "2026-2027 Autumn-Winter",
        classNo: "9000002007",
      },
    ]);
  });

  it("imports homework, forums with deadlines and exams, and skips finished past work", () => {
    const { tasks, skippedPast } = mapTronclass(tronclass(), NOW);
    expect(tasks).toEqual([
      { externalId: "tc:activity:910001", courseExternalId: "tc:course:900001", type: "assignment", title: "Essay 1", dueAt: Date.parse("2026-10-20T15:59:00Z"), notes: null },
      {
        externalId: "tc:activity:910004",
        courseExternalId: "tc:course:900001",
        type: "assignment",
        title: "Forum: Discussion week 5",
        dueAt: Date.parse("2026-10-14T05:00:00Z"),
        notes: NOT_ON_TODO_NOTE,
      },
      { externalId: "tc:exam:920001", courseExternalId: "tc:course:900001", type: "exam", title: "Quiz 1", dueAt: Date.parse("2026-10-15T14:00:00Z"), notes: null },
      { externalId: "tc:activity:910010", courseExternalId: "tc:course:900002", type: "assignment", title: "Characters L2", dueAt: Date.parse("2026-10-14T04:00:00Z"), notes: null },
    ]);
    expect(skippedPast).toBe(1);
  });

  it("keeps past items that are still on the ZJU to-do list", () => {
    const later = Date.parse("2026-10-16T00:00:00Z");
    const { tasks } = mapTronclass(tronclass(), later);
    expect(tasks.map((t) => t.title)).toContain("Quiz 1");
    expect(tasks.map((t) => t.title)).not.toContain("Forum: Discussion week 5");
  });
});

describe("mapYjsy", () => {
  it("parses week lists", () => {
    expect(parseWeeks("1,3,5,7")).toEqual([1, 3, 5, 7]);
    expect(parseWeeks("3，1, 3 2")).toEqual([1, 2, 3]);
    expect(parseWeeks("")).toEqual([]);
  });

  it("builds the term with clock times for each period", () => {
    const { term } = mapYjsy(yjsy());
    expect(term).toMatchObject({ id: "yjsy:2026-12", name: "2026–2027", startDate: "2026-09-14", weeks: 18 });
    expect(term.periods[1]).toEqual({ period: 2, startMinute: 530, endMinute: 575 });
  });

  it("turns timetable rows into class times and skips rows with unknown periods", () => {
    const { meetings, skipped } = mapYjsy(yjsy());
    expect(meetings).toEqual([
      { externalId: "yjsy:9000001001:2:2-5:1.3.5.7", classNo: "9000001001", courseTitle: "Demo Strategy", teacher: "Dr. Demo", weekday: 2, startMinute: 530, endMinute: 745, room: "Demo Hall 101", weeks: [1, 3, 5, 7] },
      {
        externalId: "yjsy:9000002007:3:3-5:1.2.3.4.5.6.7.8.9.10.11.12.13.14.15.16",
        classNo: "9000002007",
        courseTitle: "Demo Chinese",
        teacher: "Ms. Sample",
        weekday: 3,
        startMinute: 600,
        endMinute: 745,
        room: "Demo Hall 202",
        weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
      },
      { externalId: "yjsy:9000003001:4:6-8:1.2.3", classNo: "9000003001", courseTitle: "Demo Seminar", teacher: "Prof. Placeholder", weekday: 4, startMinute: 805, endMinute: 950, room: "Demo Building", weeks: [1, 2, 3] },
    ]);
    expect(skipped).toBe(1);
  });

  it("keeps courses that have no weekly slot, with their room note", () => {
    expect(mapYjsy(yjsy()).noticeCourses).toEqual([
      { classNo: "9000004001", title: "Demo Workshop", teacher: "Visiting expert", note: "Room C1 (23 Oct in B2)" },
    ]);
  });
});

describe("schemas", () => {
  it("rejects a snapshot with the wrong shape", () => {
    expect(tronclassSnapshotSchema.safeParse({ courses: "nope" }).success).toBe(false);
    expect(yjsySnapshotSchema.safeParse({ calendar: {} }).success).toBe(false);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run tests/import/mapping.test.ts`
Expected: FAIL with "Failed to resolve import @/import/schemas".

- [ ] **Step 5: Implement**

`src/import/schemas.ts`:

```ts
import { z } from "zod";

const time = z.string().nullable();

export const tronclassSnapshotSchema = z.object({
  source: z.string(),
  fetched_at: z.string(),
  todos: z.array(
    z.object({
      id: z.number(),
      type: z.string(),
      title: z.string(),
      course_id: z.number(),
      course_name: z.string(),
      end_time: time,
    }),
  ),
  courses: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      code: z.string().nullable(),
      credit: z.number().nullable(),
      department: z.string().nullable(),
      semester: z.string().nullable(),
      academic_year: z.string().nullable(),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
      instructors: z.array(z.string()),
      activities: z.array(
        z.object({
          id: z.number(),
          type: z.string(),
          title: z.string(),
          start_time: time,
          end_time: time,
          is_closed: z.boolean().nullable(),
          published: z.boolean().nullable(),
          module_id: z.number().nullable(),
          uploads: z.array(
            z.object({ id: z.number(), name: z.string(), size: z.number().nullable(), type: z.string().nullable() }),
          ),
        }),
      ),
      exams: z.array(
        z.object({
          id: z.number(),
          type: z.string(),
          title: z.string(),
          start_time: time,
          end_time: time,
          is_closed: z.boolean().nullable(),
        }),
      ),
    }),
  ),
});

export type TronclassSnapshot = z.infer<typeof tronclassSnapshotSchema>;

export const yjsySnapshotSchema = z.object({
  source: z.string(),
  fetched_at: z.string(),
  calendar: z.object({
    year: z.string(),
    term_code: z.string(),
    start: z.string(),
    end: z.string().nullable(),
    weeks: z.number().int().positive(),
    teaching_weeks: z.number().nullable(),
    exam_weeks: z.number().nullable(),
    periods: z.array(z.object({ period: z.number(), start: z.number(), end: z.number(), part: z.string().nullable() })),
  }),
  classes: z.array(
    z.object({
      course: z.string(),
      class_no: z.string(),
      teacher: z.string().nullable(),
      weekday: z.number().int().min(1).max(7),
      start_period: z.number(),
      end_period: z.number(),
      weeks: z.string(),
      term: z.string().nullable(),
      campus: z.string().nullable(),
      building: z.string().nullable(),
      room: z.string().nullable(),
    }),
  ),
  notices: z.array(
    z.object({
      course: z.string(),
      course_code: z.string().nullable(),
      class_no: z.string(),
      college: z.string().nullable(),
      teacher: z.string().nullable(),
      credit: z.number().nullable(),
      hours: z.number().nullable(),
      term: z.string().nullable(),
      note: z.string().nullable(),
      time_place: z.string().nullable(),
      status: z.string().nullable(),
    }),
  ),
});

export type YjsySnapshot = z.infer<typeof yjsySnapshotSchema>;
```

`src/import/tronclass.ts`:

```ts
import type { TronclassSnapshot } from "@/import/schemas";

export const NOT_ON_TODO_NOTE = "Not on your ZJU to-do list. You may have done it already.";

export type ImportedCourse = {
  externalId: string;
  title: string;
  code: string | null;
  instructor: string | null;
  semester: string | null;
  classNo: string | null;
};

export type ImportedTask = {
  externalId: string;
  courseExternalId: string;
  type: "assignment" | "exam";
  title: string;
  dueAt: number;
  notes: string | null;
};

export function classNoFromCode(code: string | null): string | null {
  if (!code) return null;
  const last = code.split("-").pop() ?? "";
  return /^\d+$/.test(last) ? last : null;
}

export function mapTronclass(
  snapshot: TronclassSnapshot,
  now: number,
): { courses: ImportedCourse[]; tasks: ImportedTask[]; skippedPast: number } {
  const onTodoList = new Set(snapshot.todos.map((t) => `${t.type === "exam" ? "exam" : "activity"}:${t.id}`));

  const courses = snapshot.courses.map((c) => ({
    externalId: `tc:course:${c.id}`,
    title: c.name,
    code: c.code,
    instructor: c.instructors.join(", ") || null,
    semester: c.semester,
    classNo: classNoFromCode(c.code),
  }));

  const tasks: ImportedTask[] = [];
  let skippedPast = 0;
  for (const c of snapshot.courses) {
    const candidates = [
      ...c.activities
        .filter((a) => a.end_time !== null && (a.type === "homework" || a.type === "forum"))
        .map((a) => ({
          key: `activity:${a.id}`,
          externalId: `tc:activity:${a.id}`,
          type: "assignment" as const,
          title: a.type === "forum" ? `Forum: ${a.title}` : a.title,
          end: a.end_time as string,
        })),
      ...c.exams
        .filter((e) => e.end_time !== null)
        .map((e) => ({
          key: `exam:${e.id}`,
          externalId: `tc:exam:${e.id}`,
          type: "exam" as const,
          title: e.title,
          end: e.end_time as string,
        })),
    ];
    for (const item of candidates) {
      const dueAt = Date.parse(item.end);
      if (Number.isNaN(dueAt)) continue;
      const onTodo = onTodoList.has(item.key);
      if (!onTodo && dueAt < now) {
        skippedPast += 1;
        continue;
      }
      tasks.push({
        externalId: item.externalId,
        courseExternalId: `tc:course:${c.id}`,
        type: item.type,
        title: item.title,
        dueAt,
        notes: onTodo ? null : NOT_ON_TODO_NOTE,
      });
    }
  }
  return { courses, tasks, skippedPast };
}
```

`src/import/yjsy.ts`:

```ts
import type { Term } from "@/db/terms";
import type { YjsySnapshot } from "@/import/schemas";
import { hhmmToMinutes } from "@/lib/time";

export type ImportedMeeting = {
  externalId: string;
  classNo: string;
  courseTitle: string;
  teacher: string | null;
  weekday: number;
  startMinute: number;
  endMinute: number;
  room: string | null;
  weeks: number[];
};

export type ImportedNoticeCourse = { classNo: string; title: string; teacher: string | null; note: string | null };

export function parseWeeks(value: string): number[] {
  const weeks = value
    .split(/[,，\s]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(weeks)].sort((a, b) => a - b);
}

export function mapYjsy(snapshot: YjsySnapshot): {
  term: Term;
  meetings: ImportedMeeting[];
  noticeCourses: ImportedNoticeCourse[];
  skipped: number;
} {
  const { calendar } = snapshot;
  const periods = calendar.periods
    .map((p) => ({ period: p.period, startMinute: hhmmToMinutes(p.start), endMinute: hhmmToMinutes(p.end) }))
    .sort((a, b) => a.period - b.period);
  const byPeriod = new Map(periods.map((p) => [p.period, p]));
  const term: Term = {
    id: `yjsy:${calendar.year}-${calendar.term_code}`,
    name: `${calendar.year}–${Number(calendar.year) + 1}`,
    startDate: calendar.start,
    weeks: calendar.weeks,
    periods,
  };

  const meetings: ImportedMeeting[] = [];
  let skipped = 0;
  for (const c of snapshot.classes) {
    const start = byPeriod.get(c.start_period);
    const end = byPeriod.get(c.end_period);
    if (!start || !end || end.endMinute <= start.startMinute) {
      skipped += 1;
      continue;
    }
    const weeks = parseWeeks(c.weeks);
    meetings.push({
      externalId: `yjsy:${c.class_no}:${c.weekday}:${c.start_period}-${c.end_period}:${weeks.join(".")}`,
      classNo: c.class_no,
      courseTitle: c.course,
      teacher: c.teacher,
      weekday: c.weekday,
      startMinute: start.startMinute,
      endMinute: end.endMinute,
      room: c.room ?? c.building ?? null,
      weeks,
    });
  }

  const noticeCourses = snapshot.notices.map((n) => ({ classNo: n.class_no, title: n.course, teacher: n.teacher, note: n.note }));
  return { term, meetings, noticeCourses, skipped };
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npx vitest run tests/import/mapping.test.ts tests/gitignore.test.ts`
Expected: PASS.

- [ ] **Step 7: Run all checks and commit**

Run: `npm run check`
Expected: all PASS.

```bash
git add package.json package-lock.json src/import/schemas.ts src/import/tronclass.ts src/import/yjsy.ts sample-data/courses-zju-sample.json sample-data/timetable-yjsy-sample.json tests/import/mapping.test.ts tests/gitignore.test.ts
git commit -m "Map ZJU snapshots to courses, class times and tasks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Import snapshots into the database

**Files:**
- Create: `src/import/run.ts`
- Test: `tests/import/run.test.ts`

**Interfaces:**
- Consumes: mapping (Task 6), repositories (Task 3), `transaction`, `all`, `one` (Task 2), `formatDue` (Task 1).
- Produces:
  - `class ImportError extends Error`
  - `type ImportSummary = { files: string[]; coursesAdded; tasksAdded; tasksUpdated; meetings; skippedPast }`
  - `listSnapshotFiles(dir: string): string[]` (file names, newest first)
  - `latestSnapshot(dir: string, prefix: string): string | null` (full path)
  - `importSnapshots(db: Db, dir: string, now?: number): ImportSummary`
  - `lastImport(db: Db): { fileName: string; importedAt: number } | null`
  - `describeImport(summary: ImportSummary): string`

Import rules:
- Read and validate both files before writing anything. Any problem throws `ImportError` and the database is unchanged.
- Everything else runs in one transaction.
- Courses match by `external_id`. On re-import only `code`, `instructor` and `semester` refresh; the owner's title, color, links and notes stay.
- Timetable rows join TronClass courses by class number. A class number with no TronClass course becomes its own course (`external_id = yjsy:class:<no>`, `code = <no>`). Notice notes are saved only when that course is created.
- Timetable class times replace themselves: delete all `yjsy:` class times, then insert the new ones.
- Tasks match by `external_id`. On re-import only `title`, `due_at` and `course_id` refresh; the owner's status, importance, estimate and notes stay.

- [ ] **Step 1: Write the failing test**

`tests/import/run.test.ts`:

```ts
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { all } from "@/db/connection";
import { getCourseByExternalId, listCourses, updateCourse } from "@/db/courses";
import { listMeetingTimes } from "@/db/meetings";
import { getTaskByExternalId, listTasks, setTaskStatus, updateTask } from "@/db/tasks";
import { listTerms } from "@/db/terms";
import { ImportError, describeImport, importSnapshots, lastImport, latestSnapshot, listSnapshotFiles } from "@/import/run";
import { memoryDb } from "../helpers/db";

const NOW = Date.parse("2026-10-12T04:00:00Z");
let dir: string;

function addSamples(target: string) {
  copyFileSync("sample-data/courses-zju-sample.json", path.join(target, "courses-zju-2026-10-12.json"));
  copyFileSync("sample-data/timetable-yjsy-sample.json", path.join(target, "timetable-yjsy-2026-10-12.json"));
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-import-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("finding snapshot files", () => {
  it("lists json snapshots newest first and picks the newest per source", () => {
    addSamples(dir);
    writeFileSync(path.join(dir, "courses-zju-2026-09-01.json"), "{}");
    writeFileSync(path.join(dir, "notes.txt"), "x");
    expect(listSnapshotFiles(dir)).toEqual([
      "timetable-yjsy-2026-10-12.json",
      "courses-zju-2026-10-12.json",
      "courses-zju-2026-09-01.json",
    ]);
    expect(latestSnapshot(dir, "courses-zju-")).toBe(path.join(dir, "courses-zju-2026-10-12.json"));
    expect(latestSnapshot(path.join(dir, "missing"), "courses-zju-")).toBeNull();
  });
});

describe("importSnapshots", () => {
  it("imports courses, the term, class times and tasks", () => {
    addSamples(dir);
    const db = memoryDb();
    const summary = importSnapshots(db, dir, NOW);
    expect(summary).toEqual({
      files: ["courses-zju-2026-10-12.json", "timetable-yjsy-2026-10-12.json"],
      coursesAdded: 4,
      tasksAdded: 4,
      tasksUpdated: 0,
      meetings: 3,
      skippedPast: 1,
    });
    expect(listCourses(db).map((c) => c.title)).toEqual(["Demo Chinese", "Demo Seminar", "Demo Strategy", "Demo Workshop"]);
    expect(listTerms(db).map((t) => t.id)).toEqual(["yjsy:2026-12"]);

    const strategy = getCourseByExternalId(db, "tc:course:900001");
    expect(listMeetingTimes(db, strategy?.id).map((m) => m.room)).toEqual(["Demo Hall 101"]);
    expect(getCourseByExternalId(db, "yjsy:class:9000004001")?.notes).toBe("Room C1 (23 Oct in B2)");
    expect(getTaskByExternalId(db, "tc:exam:920001")).toMatchObject({ type: "exam", courseId: strategy?.id, source: "zju" });
    expect(lastImport(db)).toEqual({ fileName: "timetable-yjsy-2026-10-12.json", importedAt: NOW });
  });

  it("is safe to run again and keeps the owner's edits", () => {
    addSamples(dir);
    const db = memoryDb();
    importSnapshots(db, dir, NOW);

    const strategy = getCourseByExternalId(db, "tc:course:900001");
    if (!strategy) throw new Error("missing course");
    updateCourse(db, strategy.id, { title: "Strategy (renamed)", color: "#111111" }, NOW);
    const essay = getTaskByExternalId(db, "tc:activity:910001");
    if (!essay) throw new Error("missing task");
    updateTask(db, essay.id, { title: essay.title, type: essay.type, courseId: essay.courseId, dueAt: essay.dueAt, importance: 3, estMinutes: 120, notes: "outline first" }, NOW);
    const quiz = getTaskByExternalId(db, "tc:exam:920001");
    if (!quiz) throw new Error("missing task");
    setTaskStatus(db, quiz.id, "done", NOW);

    const again = importSnapshots(db, dir, NOW + 1000);
    expect(again).toMatchObject({ coursesAdded: 0, tasksAdded: 0, tasksUpdated: 4, meetings: 3 });
    expect(listCourses(db)).toHaveLength(4);
    expect(listMeetingTimes(db)).toHaveLength(3);
    expect(listTasks(db, { includeDone: true })).toHaveLength(4);
    expect(getCourseByExternalId(db, "tc:course:900001")).toMatchObject({ title: "Strategy (renamed)", color: "#111111" });
    expect(getTaskByExternalId(db, "tc:activity:910001")).toMatchObject({ importance: 3, estMinutes: 120, notes: "outline first" });
    expect(getTaskByExternalId(db, "tc:exam:920001")?.status).toBe("done");
  });

  it("fails clearly on a malformed snapshot and changes nothing", () => {
    addSamples(dir);
    writeFileSync(path.join(dir, "timetable-yjsy-2026-10-13.json"), JSON.stringify({ calendar: { year: 2026 } }));
    const db = memoryDb();
    expect(() => importSnapshots(db, dir, NOW)).toThrow(ImportError);
    expect(() => importSnapshots(db, dir, NOW)).toThrow(/timetable-yjsy-2026-10-13\.json has an unexpected format/);
    expect(listCourses(db)).toEqual([]);
    expect(all(db, "SELECT * FROM import_runs")).toEqual([]);
  });

  it("fails clearly on a file that is not JSON", () => {
    writeFileSync(path.join(dir, "courses-zju-2026-10-12.json"), "{ not json");
    expect(() => importSnapshots(memoryDb(), dir, NOW)).toThrow(/is not valid JSON/);
  });

  it("does nothing when there are no snapshots", () => {
    const db = memoryDb();
    expect(importSnapshots(db, dir, NOW)).toEqual({ files: [], coursesAdded: 0, tasksAdded: 0, tasksUpdated: 0, meetings: 0, skippedPast: 0 });
    expect(lastImport(db)).toBeNull();
  });
});

describe("describeImport", () => {
  it("sums up an import in one sentence", () => {
    expect(describeImport({ files: ["a"], coursesAdded: 4, tasksAdded: 4, tasksUpdated: 0, meetings: 3, skippedPast: 1 })).toBe(
      "Added 4 courses and 4 tasks, updated 0 tasks, saved 3 class times. Skipped 1 past item that was not on your ZJU to-do list.",
    );
    expect(describeImport({ files: [], coursesAdded: 0, tasksAdded: 0, tasksUpdated: 0, meetings: 0, skippedPast: 0 })).toBe(
      "No snapshot files found.",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/import/run.test.ts`
Expected: FAIL with "Failed to resolve import @/import/run".

- [ ] **Step 3: Implement**

`src/import/run.ts`:

```ts
// Server-only: reads snapshot files from DATA_DIR/snapshots and writes them into the database.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { z } from "zod";
import { one, transaction, type Db } from "@/db/connection";
import { createCourse, getCourseByExternalId, listCourses, type CourseInput } from "@/db/courses";
import { addMeetingTime, deleteMeetingTimesByExternalPrefix } from "@/db/meetings";
import { createTask, getTaskByExternalId } from "@/db/tasks";
import { upsertTerm } from "@/db/terms";
import { tronclassSnapshotSchema, yjsySnapshotSchema } from "@/import/schemas";
import { classNoFromCode, mapTronclass } from "@/import/tronclass";
import { mapYjsy } from "@/import/yjsy";

export class ImportError extends Error {
  name = "ImportError";
}

export type ImportSummary = {
  files: string[];
  coursesAdded: number;
  tasksAdded: number;
  tasksUpdated: number;
  meetings: number;
  skippedPast: number;
};

const TRONCLASS_PREFIX = "courses-zju-";
const YJSY_PREFIX = "timetable-yjsy-";

// Snapshot names end in a date ("…-YYYY-MM-DD.json"); slice(-15) is that date plus ".json".
export function listSnapshotFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json") && (name.startsWith(TRONCLASS_PREFIX) || name.startsWith(YJSY_PREFIX)))
    .sort((a, b) => b.slice(-15).localeCompare(a.slice(-15)) || b.localeCompare(a));
}

export function latestSnapshot(dir: string, prefix: string): string | null {
  if (!existsSync(dir)) return null;
  const names = readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .sort();
  const newest = names.at(-1);
  return newest ? path.join(dir, newest) : null;
}

function readSnapshot<T>(file: string, schema: z.ZodType<T>): T {
  const name = path.basename(file);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new ImportError(`${name} is not valid JSON.`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? issue.path.join(".") : "top level";
    throw new ImportError(`${name} has an unexpected format (${where}: ${issue?.message ?? "invalid"}).`);
  }
  return parsed.data;
}

export function importSnapshots(db: Db, dir: string, now = Date.now()): ImportSummary {
  const tronclassFile = latestSnapshot(dir, TRONCLASS_PREFIX);
  const yjsyFile = latestSnapshot(dir, YJSY_PREFIX);
  // Validate everything before writing anything.
  const tronclass = tronclassFile ? mapTronclass(readSnapshot(tronclassFile, tronclassSnapshotSchema), now) : null;
  const yjsy = yjsyFile ? mapYjsy(readSnapshot(yjsyFile, yjsySnapshotSchema)) : null;

  const summary: ImportSummary = {
    files: [tronclassFile, yjsyFile].filter((f): f is string => f !== null).map((f) => path.basename(f)),
    coursesAdded: 0,
    tasksAdded: 0,
    tasksUpdated: 0,
    meetings: 0,
    skippedPast: tronclass?.skippedPast ?? 0,
  };

  transaction(db, () => {
    const courseIdByExternal = new Map<string, string>();
    const courseIdByClassNo = new Map<string, string>();

    const ensureCourse = (externalId: string, input: CourseInput, classNo: string | null): string => {
      const existing = getCourseByExternalId(db, externalId);
      let id: string;
      if (existing) {
        db.prepare("UPDATE courses SET code = ?, instructor = ?, semester = ?, updated_at = ? WHERE id = ?").run(
          input.code ?? existing.code,
          input.instructor ?? existing.instructor,
          input.semester ?? existing.semester,
          now,
          existing.id,
        );
        id = existing.id;
      } else {
        id = createCourse(db, input, { now, source: "zju", externalId }).id;
        summary.coursesAdded += 1;
      }
      courseIdByExternal.set(externalId, id);
      if (classNo) courseIdByClassNo.set(classNo, id);
      return id;
    };

    for (const c of tronclass?.courses ?? []) {
      ensureCourse(c.externalId, { title: c.title, code: c.code, instructor: c.instructor, semester: c.semester }, c.classNo);
    }
    for (const c of listCourses(db)) {
      const classNo = classNoFromCode(c.code);
      if (classNo && !courseIdByClassNo.has(classNo)) courseIdByClassNo.set(classNo, c.id);
    }

    if (yjsy) {
      upsertTerm(db, yjsy.term);
      const courseFor = (classNo: string, title: string, teacher: string | null, notes: string | null = null) =>
        courseIdByClassNo.get(classNo) ??
        ensureCourse(`yjsy:class:${classNo}`, { title, code: classNo, instructor: teacher, notes }, classNo);

      deleteMeetingTimesByExternalPrefix(db, "yjsy:");
      for (const m of yjsy.meetings) {
        addMeetingTime(db, {
          courseId: courseFor(m.classNo, m.courseTitle, m.teacher),
          termId: yjsy.term.id,
          weekday: m.weekday,
          startMinute: m.startMinute,
          endMinute: m.endMinute,
          room: m.room,
          weeks: m.weeks,
          externalId: m.externalId,
        });
        summary.meetings += 1;
      }
      for (const n of yjsy.noticeCourses) courseFor(n.classNo, n.title, n.teacher, n.note);
    }

    for (const t of tronclass?.tasks ?? []) {
      const courseId = courseIdByExternal.get(t.courseExternalId) ?? null;
      const existing = getTaskByExternalId(db, t.externalId);
      if (existing) {
        db.prepare("UPDATE tasks SET title = ?, due_at = ?, course_id = ?, updated_at = ? WHERE id = ?").run(
          t.title,
          t.dueAt,
          courseId,
          now,
          existing.id,
        );
        summary.tasksUpdated += 1;
      } else {
        createTask(db, { title: t.title, type: t.type, courseId, dueAt: t.dueAt, notes: t.notes }, { now, source: "zju", externalId: t.externalId });
        summary.tasksAdded += 1;
      }
    }

    const record = db.prepare(
      "INSERT INTO import_runs (id, source, file_name, imported_at, counts_json) VALUES (?, ?, ?, ?, ?)",
    );
    if (tronclassFile) record.run(randomUUID(), "courses.zju.edu.cn", path.basename(tronclassFile), now, JSON.stringify(summary));
    if (yjsyFile) record.run(randomUUID(), "yjsy.zju.edu.cn", path.basename(yjsyFile), now, JSON.stringify(summary));
  });

  return summary;
}

export function lastImport(db: Db): { fileName: string; importedAt: number } | null {
  const row = one<{ file_name: string; imported_at: number }>(
    db,
    "SELECT file_name, imported_at FROM import_runs ORDER BY imported_at DESC, rowid DESC LIMIT 1",
  );
  return row ? { fileName: row.file_name, importedAt: row.imported_at } : null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function describeImport(summary: ImportSummary): string {
  if (summary.files.length === 0) return "No snapshot files found.";
  const sentence = `Added ${plural(summary.coursesAdded, "course")} and ${plural(summary.tasksAdded, "task")}, updated ${plural(summary.tasksUpdated, "task")}, saved ${plural(summary.meetings, "class time")}.`;
  if (summary.skippedPast === 0) return sentence;
  const skipped = summary.skippedPast === 1 ? "1 past item that was" : `${summary.skippedPast} past items that were`;
  return `${sentence} Skipped ${skipped} not on your ZJU to-do list.`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/import/run.test.ts`
Expected: PASS.

- [ ] **Step 5: Run all checks and commit**

Run: `npm run check`
Expected: all PASS.

```bash
git add src/import/run.ts tests/import/run.test.ts
git commit -m "Import ZJU snapshots, keeping the owner's edits" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Form validation and server actions

**Files:**
- Create: `src/lib/forms.ts`, `src/lib/action-state.ts`, `src/app/actions.ts`
- Test: `tests/lib/forms.test.ts`, `tests/actions.test.ts`

**Interfaces:**
- Consumes: repositories (Tasks 3, 4), `importSnapshots`, `describeImport`, `ImportError` (Task 7), `getDb` (Task 2), `getDataDir`, `DataDirError` (M0), time parsers (Task 1).
- Produces:
  - `@/lib/action-state`: `type ActionState = { ok: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, string>; nonce: number }`, `INITIAL_ACTION_STATE`, `formValues(fd: FormData): Record<string, string>`
  - `@/lib/forms`: `type FormResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> }`, `parseCourseForm(fd): FormResult<CourseInput>`, `parseTaskForm(fd): FormResult<TaskInput>`, `parseMeetingForm(fd): FormResult<MeetingInput>`, `parseRuleForm(fd): FormResult<RuleInput>`
  - `@/app/actions` (server actions): `createTaskAction(prev, fd)`, `setTaskStatusAction(fd)`, `postponeTaskAction(fd)`, `deleteTaskAction(fd)`, `createCourseAction(prev, fd)`, `updateCourseAction(prev, fd)`, `deleteCourseAction(fd)`, `addMeetingAction(prev, fd)`, `deleteMeetingAction(fd)`, `createRuleAction(prev, fd)`, `deleteRuleAction(fd)`, `importSnapshotsAction(prev, fd)`. The `(prev, fd)` ones return `Promise<ActionState>` for `useActionState`; the `(fd)` ones return `Promise<void>` for plain `<form action>`.

Form field names (shared with the UI tasks):
- Course: `title`, `code`, `instructor`, `semester`, `color`, `links` (one URL per line), `notes`; edit forms add a hidden `id`.
- Task: `title`, `type`, `courseId`, `due` (datetime-local), `estMinutes`, `importance` (`1`–`3`), `notes`.
- Class time: `courseId`, `weekday` (`1`–`7`), `start`, `end` (`HH:MM`), `room`.
- Prep rule: `courseId`, `title`, `leadHours`, `estMinutes`, `importance`.
- Status buttons: hidden `id` and `status`. Delete buttons: hidden `id`.

- [ ] **Step 1: Write the failing tests**

`tests/lib/forms.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCourseForm, parseMeetingForm, parseRuleForm, parseTaskForm } from "@/lib/forms";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

const task = (overrides: Record<string, string> = {}) =>
  form({ title: "Essay", type: "assignment", courseId: "", due: "", estMinutes: "", importance: "2", notes: "", ...overrides });

describe("parseTaskForm", () => {
  it("accepts a full task and converts the due time from Shanghai", () => {
    expect(parseTaskForm(task({ courseId: "c1", due: "2026-10-19T23:59", estMinutes: "90", importance: "3", notes: " outline " }))).toEqual({
      ok: true,
      value: {
        title: "Essay",
        type: "assignment",
        courseId: "c1",
        dueAt: Date.parse("2026-10-19T15:59:00Z"),
        estMinutes: 90,
        importance: 3,
        notes: "outline",
      },
    });
  });

  it("turns empty optional fields into null", () => {
    expect(parseTaskForm(task())).toEqual({
      ok: true,
      value: { title: "Essay", type: "assignment", courseId: null, dueAt: null, estMinutes: null, importance: 2, notes: null },
    });
  });

  it("explains each bad field", () => {
    const result = parseTaskForm(task({ title: "  ", type: "party", due: "2026-02-30T10:00", estMinutes: "-5", importance: "9" }));
    expect(result).toEqual({
      ok: false,
      errors: {
        title: "Give the task a title.",
        type: "Pick a task type.",
        due: "Use a real date and time.",
        estMinutes: "Estimated minutes must be a whole number from 1 to 6000.",
        importance: "Pick an importance.",
      },
    });
  });
});

describe("parseCourseForm", () => {
  const course = (overrides: Record<string, string> = {}) =>
    form({ title: "Demo", code: "", instructor: "", semester: "", color: "#2f5d62", links: "", notes: "", ...overrides });

  it("accepts links one per line", () => {
    const result = parseCourseForm(course({ links: "https://a.example\n\n  http://b.example/x  " }));
    expect(result).toMatchObject({ ok: true, value: { title: "Demo", links: ["https://a.example", "http://b.example/x"], color: "#2f5d62" } });
  });

  it("rejects a missing title, a bad color and a non-web link", () => {
    expect(parseCourseForm(course({ title: "", color: "red", links: "ftp://x" }))).toEqual({
      ok: false,
      errors: { title: "Give the course a title.", color: "Pick a color.", links: "Not a web link: ftp://x" },
    });
  });
});

describe("parseMeetingForm", () => {
  const meeting = (overrides: Record<string, string> = {}) =>
    form({ courseId: "c1", weekday: "2", start: "08:50", end: "12:25", room: "", ...overrides });

  it("accepts a class time", () => {
    expect(parseMeetingForm(meeting({ room: "Hall 1" }))).toEqual({
      ok: true,
      value: { courseId: "c1", weekday: 2, startMinute: 530, endMinute: 745, room: "Hall 1" },
    });
  });

  it("rejects an end before the start and a bad weekday", () => {
    expect(parseMeetingForm(meeting({ weekday: "8", start: "12:00", end: "11:00" }))).toEqual({
      ok: false,
      errors: { weekday: "Pick a day.", end: "End must be after start." },
    });
    expect(parseMeetingForm(meeting({ start: "noon" }))).toEqual({ ok: false, errors: { start: "Use a time like 08:50." } });
  });
});

describe("parseRuleForm", () => {
  const rule = (overrides: Record<string, string> = {}) =>
    form({ courseId: "c1", title: "", leadHours: "12", estMinutes: "45", importance: "2", ...overrides });

  it("defaults the title and converts hours to minutes", () => {
    expect(parseRuleForm(rule({ leadHours: "1.5" }))).toEqual({
      ok: true,
      value: { courseId: "c1", title: "Prepare for class", leadMinutes: 90, estMinutes: 45, importance: 2 },
    });
  });

  it("rejects a negative lead time", () => {
    expect(parseRuleForm(rule({ leadHours: "-1" }))).toEqual({
      ok: false,
      errors: { leadHours: "Use a number of hours from 0 to 168." },
    });
  });
});
```

`tests/actions.test.ts`:

```ts
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

import { createCourseAction, createTaskAction, deleteCourseAction, importSnapshotsAction, setTaskStatusAction } from "@/app/actions";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { listTasks } from "@/db/tasks";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-actions-"));
  vi.stubEnv("DATA_DIR", dir);
  refresh.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("task actions", () => {
  it("saves a valid task and refreshes the page", async () => {
    const state = await createTaskAction(
      INITIAL_ACTION_STATE,
      form({ title: "Essay", type: "assignment", courseId: "", due: "", estMinutes: "", importance: "2", notes: "" }),
    );
    expect(state).toMatchObject({ ok: true, message: "Task added." });
    expect(listTasks(getDb()).map((t) => t.title)).toEqual(["Essay"]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("returns field errors and the typed values, and saves nothing", async () => {
    const state = await createTaskAction(
      INITIAL_ACTION_STATE,
      form({ title: "", type: "assignment", courseId: "", due: "", estMinutes: "", importance: "2", notes: "keep me" }),
    );
    expect(state).toMatchObject({ ok: false, errors: { title: "Give the task a title." }, values: { notes: "keep me" } });
    expect(listTasks(getDb())).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("marks a task done and ignores unknown statuses", async () => {
    await createTaskAction(INITIAL_ACTION_STATE, form({ title: "x", type: "reading", courseId: "", due: "", estMinutes: "", importance: "2", notes: "" }));
    const [task] = listTasks(getDb());
    await setTaskStatusAction(form({ id: task.id, status: "nonsense" }));
    expect(listTasks(getDb())).toHaveLength(1);
    await setTaskStatusAction(form({ id: task.id, status: "done" }));
    expect(listTasks(getDb())).toEqual([]);
  });
});

describe("course actions", () => {
  it("creates a course, then deletes it and goes back to the list", async () => {
    const state = await createCourseAction(
      INITIAL_ACTION_STATE,
      form({ title: "Demo", code: "", instructor: "", semester: "", color: "#2f5d62", links: "", notes: "" }),
    );
    expect(state.ok).toBe(true);
    const [course] = listCourses(getDb());
    await expect(deleteCourseAction(form({ id: course.id }))).rejects.toThrow("REDIRECT /courses");
    expect(listCourses(getDb())).toEqual([]);
  });
});

describe("importSnapshotsAction", () => {
  it("imports from DATA_DIR/snapshots and reports what it did", async () => {
    mkdirSync(path.join(dir, "snapshots"));
    copyFileSync("sample-data/courses-zju-sample.json", path.join(dir, "snapshots", "courses-zju-2026-10-12.json"));
    const state = await importSnapshotsAction(INITIAL_ACTION_STATE, new FormData());
    expect(state.ok).toBe(true);
    expect(state.message).toMatch(/^Added 2 courses/);
    expect(listCourses(getDb())).toHaveLength(2);
  });

  it("reports a broken snapshot instead of crashing", async () => {
    mkdirSync(path.join(dir, "snapshots"));
    copyFileSync("package.json", path.join(dir, "snapshots", "courses-zju-2026-10-12.json"));
    const state = await importSnapshotsAction(INITIAL_ACTION_STATE, new FormData());
    expect(state).toMatchObject({ ok: false });
    expect(state.message).toMatch(/unexpected format/);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/lib/forms.test.ts tests/actions.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/forms" / "@/app/actions".

- [ ] **Step 3: Implement**

`src/lib/action-state.ts`:

```ts
export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  nonce: number;
};

export const INITIAL_ACTION_STATE: ActionState = { ok: false, nonce: 0 };

export function formValues(fd: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of fd.entries()) if (typeof value === "string") values[key] = value;
  return values;
}
```

`src/lib/forms.ts`:

```ts
import { z } from "zod";
import type { CourseInput } from "@/db/courses";
import type { MeetingInput } from "@/db/meetings";
import type { RuleInput } from "@/db/rules";
import { TASK_TYPES, type Importance, type TaskInput } from "@/db/tasks";
import { parseClock, parseLocalDateTime } from "@/lib/time";

export type FormResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

function read(fd: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, String(fd.get(key) ?? "")]));
}

function toErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

const optionalInt = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number from ${min} to ${max}.` });
        return z.NEVER;
      }
      return n;
    });

const importance = z.enum(["1", "2", "3"], { error: "Pick an importance." }).transform((v) => Number(v) as Importance);

const taskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(200, "Keep the title under 200 characters."),
  type: z.enum(TASK_TYPES, { error: "Pick a task type." }),
  courseId: optionalText(64),
  due: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const ms = parseLocalDateTime(v);
      if (ms === null) {
        ctx.addIssue({ code: "custom", message: "Use a real date and time." });
        return z.NEVER;
      }
      return ms;
    }),
  estMinutes: optionalInt(1, 6000, "Estimated minutes"),
  importance,
  notes: optionalText(2000),
});

export function parseTaskForm(fd: FormData): FormResult<TaskInput> {
  const r = taskSchema.safeParse(read(fd, ["title", "type", "courseId", "due", "estMinutes", "importance", "notes"]));
  if (!r.success) return { ok: false, errors: toErrors(r.error) };
  const d = r.data;
  return {
    ok: true,
    value: { title: d.title, type: d.type, courseId: d.courseId, dueAt: d.due, estMinutes: d.estMinutes, importance: d.importance, notes: d.notes },
  };
}

const courseSchema = z.object({
  title: z.string().trim().min(1, "Give the course a title.").max(120, "Keep the title under 120 characters."),
  code: optionalText(60),
  instructor: optionalText(200),
  semester: optionalText(60),
  color: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return undefined;
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "Pick a color." });
        return z.NEVER;
      }
      return v.toLowerCase();
    }),
  links: z.string().transform((v, ctx) => {
    const lines = v
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const bad = lines.find((line) => !/^https?:\/\/\S+$/i.test(line));
    if (bad) {
      ctx.addIssue({ code: "custom", message: `Not a web link: ${bad}` });
      return z.NEVER;
    }
    return lines;
  }),
  notes: optionalText(2000),
});

export function parseCourseForm(fd: FormData): FormResult<CourseInput> {
  const r = courseSchema.safeParse(read(fd, ["title", "code", "instructor", "semester", "color", "links", "notes"]));
  if (!r.success) return { ok: false, errors: toErrors(r.error) };
  return { ok: true, value: r.data };
}

const clock = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const minutes = parseClock(v);
    if (minutes === null) {
      ctx.addIssue({ code: "custom", message: "Use a time like 08:50." });
      return z.NEVER;
    }
    return minutes;
  });

const meetingFields = z.object({
  courseId: z.string().trim().min(1, "Pick a course."),
  weekday: z.enum(["1", "2", "3", "4", "5", "6", "7"], { error: "Pick a day." }).transform(Number),
  start: clock,
  end: clock,
  room: optionalText(80),
});

// The start/end comparison runs outside Zod so it is reported even when another field fails.
export function parseMeetingForm(fd: FormData): FormResult<MeetingInput> {
  const raw = read(fd, ["courseId", "weekday", "start", "end", "room"]);
  const r = meetingFields.safeParse(raw);
  const errors: Record<string, string> = r.success ? {} : toErrors(r.error);
  const start = parseClock(raw.start);
  const end = parseClock(raw.end);
  if (start !== null && end !== null && end <= start) errors.end ??= "End must be after start.";
  if (!r.success || Object.keys(errors).length) return { ok: false, errors };
  const d = r.data;
  return { ok: true, value: { courseId: d.courseId, weekday: d.weekday, startMinute: d.start, endMinute: d.end, room: d.room } };
}

const ruleSchema = z.object({
  courseId: z.string().trim().min(1, "Pick a course."),
  title: z
    .string()
    .trim()
    .max(120, "Keep the title under 120 characters.")
    .transform((v) => v || "Prepare for class"),
  leadHours: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const hours = Number(v);
      if (v === "" || !Number.isFinite(hours) || hours < 0 || hours > 168) {
        ctx.addIssue({ code: "custom", message: "Use a number of hours from 0 to 168." });
        return z.NEVER;
      }
      return Math.round(hours * 60);
    }),
  estMinutes: optionalInt(1, 600, "Estimated minutes"),
  importance,
});

export function parseRuleForm(fd: FormData): FormResult<RuleInput> {
  const r = ruleSchema.safeParse(read(fd, ["courseId", "title", "leadHours", "estMinutes", "importance"]));
  if (!r.success) return { ok: false, errors: toErrors(r.error) };
  const d = r.data;
  return { ok: true, value: { courseId: d.courseId, title: d.title, leadMinutes: d.leadHours, estMinutes: d.estMinutes, importance: d.importance } };
}
```

`src/app/actions.ts`:

```ts
"use server";

import path from "node:path";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/connection";
import { createCourse, deleteCourse, updateCourse } from "@/db/courses";
import { addMeetingTime, deleteMeetingTime } from "@/db/meetings";
import { createRule, deleteRule, materializePrepTasks } from "@/db/rules";
import { TASK_STATUSES, createTask, deleteTask, postponeTask, setTaskStatus, type TaskStatus } from "@/db/tasks";
import { ImportError, describeImport, importSnapshots } from "@/import/run";
import { formValues, type ActionState } from "@/lib/action-state";
import { DataDirError, getDataDir } from "@/lib/data-dir";
import { parseCourseForm, parseMeetingForm, parseRuleForm, parseTaskForm, type FormResult } from "@/lib/forms";
import { DAY_MS } from "@/lib/time";

const idOf = (fd: FormData) => String(fd.get("id") ?? "");

function failed<T>(result: Extract<FormResult<T>, { ok: false }>, fd: FormData): ActionState {
  return { ok: false, errors: result.errors, values: formValues(fd), nonce: Date.now() };
}

function done(message: string): ActionState {
  refresh();
  return { ok: true, message, nonce: Date.now() };
}

export async function createTaskAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseTaskForm(fd);
  if (!parsed.ok) return failed(parsed, fd);
  createTask(getDb(), parsed.value);
  return done("Task added.");
}

export async function setTaskStatusAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  const status = String(fd.get("status") ?? "");
  if (!id || !(TASK_STATUSES as readonly string[]).includes(status)) return;
  setTaskStatus(getDb(), id, status as TaskStatus);
  refresh();
}

export async function postponeTaskAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (!id) return;
  postponeTask(getDb(), id, DAY_MS);
  refresh();
}

export async function deleteTaskAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (!id) return;
  deleteTask(getDb(), id);
  refresh();
}

export async function createCourseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseCourseForm(fd);
  if (!parsed.ok) return failed(parsed, fd);
  createCourse(getDb(), parsed.value);
  return done("Course added.");
}

export async function updateCourseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseCourseForm(fd);
  if (!parsed.ok) return failed(parsed, fd);
  updateCourse(getDb(), idOf(fd), parsed.value);
  return done("Course saved.");
}

export async function deleteCourseAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (id) deleteCourse(getDb(), id);
  redirect("/courses");
}

export async function addMeetingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseMeetingForm(fd);
  if (!parsed.ok) return failed(parsed, fd);
  addMeetingTime(getDb(), parsed.value);
  return done("Class time added.");
}

export async function deleteMeetingAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (!id) return;
  deleteMeetingTime(getDb(), id);
  refresh();
}

export async function createRuleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseRuleForm(fd);
  if (!parsed.ok) return failed(parsed, fd);
  const db = getDb();
  createRule(db, parsed.value);
  const added = materializePrepTasks(db, Date.now());
  return done(added ? `Prep routine added. ${added} prep tasks created for the next two weeks.` : "Prep routine added.");
}

export async function deleteRuleAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (!id) return;
  deleteRule(getDb(), id);
  refresh();
}

// useActionState always passes (state, formData); this action needs neither.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function importSnapshotsAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  try {
    const summary = importSnapshots(getDb(), path.join(getDataDir(), "snapshots"));
    return done(describeImport(summary));
  } catch (error) {
    if (error instanceof ImportError || error instanceof DataDirError) {
      return { ok: false, message: error.message, nonce: Date.now() };
    }
    throw error;
  }
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/lib/forms.test.ts tests/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Run all checks and commit**

Run: `npm run check`
Expected: all PASS.

```bash
git add src/lib/forms.ts src/lib/action-state.ts src/app/actions.ts tests/lib/forms.test.ts tests/actions.test.ts
git commit -m "Add form validation and server actions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Deadlines page

**Files:**
- Create: `src/components/ui.ts`, `src/lib/labels.ts`, `src/components/field.tsx`, `src/components/course-dot.tsx`, `src/components/task-row.tsx`, `src/components/task-form.tsx`, `src/components/workload-chart.tsx`, `src/components/deadlines-data.tsx`
- Modify: `src/app/deadlines/page.tsx` (full replace), `tests/pages.test.tsx` (add one mock)
- Test: `tests/components/deadlines-data.test.tsx`

**Interfaces:**
- Consumes: repositories (Tasks 3, 4), `groupTasks`, `weeklyWorkload`, `describeLoad` (Task 5), actions and `ActionState` (Task 8), `EmptyState`, `PageHeader` (M0), time helpers (Task 1).
- Produces:
  - `@/components/ui`: class strings `BUTTON_PRIMARY`, `BUTTON_SECONDARY`, `BUTTON_DANGER`, `INPUT`, `LABEL`, `CARD`
  - `@/lib/labels`: `TASK_TYPE_LABELS: Record<TaskType, string>`, `IMPORTANCE_LABELS: Record<Importance, string>`, `WEEKDAY_LABELS` (Monday … Sunday). Type-only imports from `@/db/tasks`, so it is safe in client components.
  - `@/components/field`: `FieldError({ form, name, errors })`, `invalidProps(form, name, errors)`, `FormMessage({ state })`
  - `@/components/course-dot`: `CourseDot({ color, size? })`
  - `@/components/task-row`: `TaskRow({ task, course, now })`, `TaskSection({ id, title, tasks, courseById, now })`
  - `@/components/task-form`: `TaskForm({ courses, defaultCourseId? })` (client). Title input id `task-title`; focuses itself when the URL hash is `#new-task`.
  - `@/components/workload-chart`: `WorkloadChart({ weeks })`
  - `@/components/deadlines-data`: async `DeadlinesData()`

Client components (`"use client"`) must not import anything that reaches `node:sqlite` or `node:crypto`: only `@/app/actions`, `@/lib/action-state`, `@/lib/labels`, `@/lib/time`, `@/components/field`, `@/components/ui`, and type-only imports.

- [ ] **Step 1: Write the failing test**

`tests/components/deadlines-data.test.tsx`:

```tsx
// @vitest-environment jsdom
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/app/actions", () => ({
  createTaskAction: vi.fn(),
  setTaskStatusAction: vi.fn(),
  postponeTaskAction: vi.fn(),
}));

import { DeadlinesData } from "@/components/deadlines-data";
import { getDb } from "@/db/connection";
import { createCourse } from "@/db/courses";
import { createTask, setTaskStatus } from "@/db/tasks";
import { DAY_MS } from "@/lib/time";

const NOW = Date.parse("2026-10-12T04:00:00Z"); // Mon 12 Oct, 12:00 Shanghai
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-deadlines-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("DeadlinesData", () => {
  it("shows the add form and an empty state on first run", async () => {
    render(await DeadlinesData());
    expect(screen.getByRole("heading", { level: 2, name: "Add a task" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "No deadlines yet" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Weekly workload" })).not.toBeInTheDocument();
  });

  it("groups tasks with their course, due time and actions", async () => {
    const db = getDb();
    const course = createCourse(db, { title: "Demo Strategy" }, { now: NOW });
    createTask(db, { title: "Old essay", type: "assignment", courseId: course.id, dueAt: NOW - 2 * DAY_MS }, { now: NOW });
    createTask(db, { title: "Quiz 1", type: "exam", courseId: course.id, dueAt: NOW + DAY_MS, estMinutes: 30 }, { now: NOW });
    createTask(db, { title: "Final report", type: "assignment", dueAt: NOW + 20 * DAY_MS }, { now: NOW });
    createTask(db, { title: "Read notes", type: "reading" }, { now: NOW });
    const finished = createTask(db, { title: "Lab 0", type: "assignment", dueAt: NOW - DAY_MS }, { now: NOW });
    setTaskStatus(db, finished.id, "done", NOW - 3600_000);

    render(await DeadlinesData());

    const overdue = screen.getByRole("region", { name: /^Overdue/ });
    expect(within(overdue).getByText("Old essay")).toBeInTheDocument();
    expect(within(overdue).getByText("Demo Strategy")).toBeInTheDocument();
    expect(within(overdue).getByText("Overdue · Sat 10 Oct, 12:00")).toBeInTheDocument();

    const thisWeek = screen.getByRole("region", { name: /^This week/ });
    expect(within(thisWeek).getByText("Quiz 1")).toBeInTheDocument();
    expect(within(thisWeek).getByText("Tomorrow 12:00")).toBeInTheDocument();
    expect(within(thisWeek).getByRole("button", { name: 'Mark "Quiz 1" done' })).toBeInTheDocument();
    expect(within(thisWeek).getByRole("button", { name: 'Postpone "Quiz 1" by one day' })).toBeInTheDocument();

    expect(within(screen.getByRole("region", { name: /^Later/ })).getByText("Final report")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /^No date/ })).getByText("Read notes")).toBeInTheDocument();

    const done = screen.getByRole("region", { name: /^Done in the last 7 days/ });
    expect(within(done).getByRole("button", { name: 'Reopen "Lab 0"' })).toBeInTheDocument();

    const workload = screen.getByRole("region", { name: "Weekly workload" });
    expect(within(workload).getByText("This week")).toBeInTheDocument();
    expect(within(workload).getByText("30 min · 2 tasks · 1 without estimate")).toBeInTheDocument();
  });

  it("offers every course in the add form", async () => {
    createCourse(getDb(), { title: "Demo Chinese" }, { now: NOW });
    render(await DeadlinesData());
    expect(screen.getByRole("option", { name: "Demo Chinese" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAttribute("id", "task-title");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/deadlines-data.test.tsx`
Expected: FAIL with "Failed to resolve import @/components/deadlines-data".

- [ ] **Step 3: Shared UI pieces**

`src/components/ui.ts`:

```ts
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const BUTTON_PRIMARY = `inline-flex items-center justify-center rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-paper disabled:opacity-60 ${FOCUS}`;
export const BUTTON_SECONDARY = `inline-flex items-center justify-center rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:bg-surface-strong ${FOCUS}`;
export const BUTTON_DANGER = `inline-flex items-center justify-center rounded-md border border-warn px-3 py-1.5 text-sm font-medium text-warn hover:bg-surface-strong ${FOCUS}`;
export const INPUT = `mt-1 block w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink aria-[invalid=true]:border-warn ${FOCUS}`;
export const LABEL = "block text-sm font-medium";
export const CARD = "rounded-lg border border-line bg-surface p-4 sm:p-6";
```

`src/lib/labels.ts`:

```ts
import type { Importance, TaskType } from "@/db/tasks";

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  assignment: "Assignment",
  reading: "Reading",
  presentation: "Presentation",
  exam: "Exam",
  personal: "Personal",
  prep: "Class prep",
};

export const IMPORTANCE_LABELS: Record<Importance, string> = { 1: "Low", 2: "Normal", 3: "High" };

export const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
```

`src/components/field.tsx`:

```tsx
import type { ActionState } from "@/lib/action-state";

type Errors = Record<string, string> | undefined;

export function invalidProps(form: string, name: string, errors: Errors) {
  return errors?.[name] ? { "aria-invalid": true as const, "aria-describedby": `${form}-${name}-error` } : {};
}

export function FieldError({ form, name, errors }: { form: string; name: string; errors: Errors }) {
  const message = errors?.[name];
  if (!message) return null;
  return (
    <p id={`${form}-${name}-error`} className="mt-1 text-sm text-warn">
      {message}
    </p>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.ok && state.message) {
    return (
      <p role="status" className="text-sm text-ink-muted">
        {state.message}
      </p>
    );
  }
  if (!state.ok && (state.message || state.errors)) {
    return (
      <p role="alert" className="text-sm text-warn">
        {state.message ?? "Check the fields marked above."}
      </p>
    );
  }
  return null;
}
```

`src/components/course-dot.tsx`:

```tsx
export function CourseDot({ color, size = "sm" }: { color: string; size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${size === "lg" ? "size-4" : "size-2.5"}`}
      style={{ backgroundColor: color }}
    />
  );
}
```

- [ ] **Step 4: Task rows, form and workload chart**

`src/components/task-row.tsx`:

```tsx
import { postponeTaskAction, setTaskStatusAction } from "@/app/actions";
import { CourseDot } from "@/components/course-dot";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD } from "@/components/ui";
import type { Course } from "@/db/courses";
import type { Task } from "@/db/tasks";
import { TASK_TYPE_LABELS } from "@/lib/labels";
import { MINUTE_MS, formatDue, humanDuration } from "@/lib/time";

type TaskRowProps = { task: Task; course: Course | null; now: number };

export function TaskRow({ task, course, now }: TaskRowProps) {
  const done = task.status === "done";
  const overdue = !done && task.dueAt !== null && task.dueAt < now;

  return (
    <li className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className={`font-medium ${done ? "text-ink-muted line-through" : ""}`}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {course && (
            <span className="inline-flex items-center gap-1.5">
              <CourseDot color={course.color} />
              {course.title}
            </span>
          )}
          <span>{TASK_TYPE_LABELS[task.type]}</span>
          {task.dueAt !== null && (
            <span className={overdue ? "font-medium text-warn" : undefined}>
              {overdue ? `Overdue · ${formatDue(task.dueAt, now)}` : formatDue(task.dueAt, now)}
            </span>
          )}
          {task.estMinutes !== null && <span>about {humanDuration(task.estMinutes * MINUTE_MS)}</span>}
          {task.importance === 3 && <span>Important</span>}
          {task.status === "postponed" && <span>Postponed</span>}
        </p>
        {task.notes && <p className="mt-1 max-w-prose text-sm text-ink-muted">{task.notes}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        {done ? (
          <form action={setTaskStatusAction}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="status" value="todo" />
            <button type="submit" className={BUTTON_SECONDARY} aria-label={`Reopen "${task.title}"`}>
              Reopen
            </button>
          </form>
        ) : (
          <>
            <form action={setTaskStatusAction}>
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="status" value="done" />
              <button type="submit" className={BUTTON_PRIMARY} aria-label={`Mark "${task.title}" done`}>
                Done
              </button>
            </form>
            <form action={postponeTaskAction}>
              <input type="hidden" name="id" value={task.id} />
              <button type="submit" className={BUTTON_SECONDARY} aria-label={`Postpone "${task.title}" by one day`}>
                +1 day
              </button>
            </form>
          </>
        )}
      </div>
    </li>
  );
}

type TaskSectionProps = { id: string; title: string; tasks: Task[]; courseById: Map<string, Course>; now: number };

export function TaskSection({ id, title, tasks, courseById, now }: TaskSectionProps) {
  return (
    <section aria-labelledby={`${id}-heading`} className={CARD}>
      <h2 id={`${id}-heading`} className="font-serif text-lg">
        {title} <span className="text-sm text-ink-muted">({tasks.length})</span>
      </h2>
      <ul className="mt-2">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} course={task.courseId ? (courseById.get(task.courseId) ?? null) : null} now={now} />
        ))}
      </ul>
    </section>
  );
}
```

`src/components/task-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTaskAction } from "@/app/actions";
import { FieldError, FormMessage, invalidProps } from "@/components/field";
import { BUTTON_PRIMARY, CARD, INPUT, LABEL } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { IMPORTANCE_LABELS, TASK_TYPE_LABELS } from "@/lib/labels";

type CourseOption = { id: string; title: string };

export function TaskForm({ courses, defaultCourseId = "" }: { courses: CourseOption[]; defaultCourseId?: string }) {
  const [state, action, pending] = useActionState(createTaskAction, INITIAL_ACTION_STATE);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusIfAsked = () => {
      if (window.location.hash === "#new-task") titleRef.current?.focus();
    };
    focusIfAsked();
    window.addEventListener("hashchange", focusIfAsked);
    return () => window.removeEventListener("hashchange", focusIfAsked);
  }, []);

  const v = state.values ?? {};
  const e = state.errors;

  return (
    <section id="new-task" aria-labelledby="new-task-heading" className={CARD}>
      <h2 id="new-task-heading" className="font-serif text-lg">
        Add a task
      </h2>
      <form key={state.nonce} action={action} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="task-title" className={LABEL}>
            Title
          </label>
          <input ref={titleRef} id="task-title" name="title" defaultValue={v.title} className={INPUT} {...invalidProps("task", "title", e)} />
          <FieldError form="task" name="title" errors={e} />
        </div>
        <div>
          <label htmlFor="task-courseId" className={LABEL}>
            Course
          </label>
          <select id="task-courseId" name="courseId" defaultValue={v.courseId ?? defaultCourseId} className={INPUT}>
            <option value="">No course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="task-type" className={LABEL}>
            Type
          </label>
          <select id="task-type" name="type" defaultValue={v.type ?? "assignment"} className={INPUT} {...invalidProps("task", "type", e)}>
            {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldError form="task" name="type" errors={e} />
        </div>
        <div>
          <label htmlFor="task-due" className={LABEL}>
            Due (Beijing time)
          </label>
          <input id="task-due" name="due" type="datetime-local" defaultValue={v.due} className={INPUT} {...invalidProps("task", "due", e)} />
          <FieldError form="task" name="due" errors={e} />
        </div>
        <div>
          <label htmlFor="task-estMinutes" className={LABEL}>
            Estimated minutes
          </label>
          <input
            id="task-estMinutes"
            name="estMinutes"
            type="number"
            min={1}
            step={5}
            inputMode="numeric"
            defaultValue={v.estMinutes}
            className={INPUT}
            {...invalidProps("task", "estMinutes", e)}
          />
          <FieldError form="task" name="estMinutes" errors={e} />
        </div>
        <div>
          <label htmlFor="task-importance" className={LABEL}>
            Importance
          </label>
          <select id="task-importance" name="importance" defaultValue={v.importance ?? "2"} className={INPUT}>
            {([1, 2, 3] as const).map((n) => (
              <option key={n} value={n}>
                {IMPORTANCE_LABELS[n]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="task-notes" className={LABEL}>
            Notes
          </label>
          <textarea id="task-notes" name="notes" rows={2} defaultValue={v.notes} className={INPUT} {...invalidProps("task", "notes", e)} />
          <FieldError form="task" name="notes" errors={e} />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
            {pending ? "Adding…" : "Add task"}
          </button>
          <FormMessage state={state} />
        </div>
      </form>
    </section>
  );
}
```

`src/components/workload-chart.tsx`:

```tsx
import { CARD } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { describeLoad, type WeekLoad } from "@/lib/workload";

function weekLabel(index: number, weekStart: number): string {
  if (index === 0) return "This week";
  if (index === 1) return "Next week";
  return `Week of ${formatDate(weekStart)}`;
}

export function WorkloadChart({ weeks }: { weeks: WeekLoad[] }) {
  const max = Math.max(60, ...weeks.map((w) => w.minutes));
  return (
    <section aria-labelledby="workload-heading" className={CARD}>
      <h2 id="workload-heading" className="font-serif text-lg">
        Weekly workload
      </h2>
      <ul className="mt-4 space-y-3">
        {weeks.map((week, i) => (
          <li key={week.weekStart}>
            <div className="flex flex-wrap justify-between gap-x-4 text-sm">
              <span>{weekLabel(i, week.weekStart)}</span>
              <span className="text-ink-muted">{describeLoad(week)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-surface-strong" aria-hidden="true">
              <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.round((week.minutes / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: The data component and page**

`src/components/deadlines-data.tsx`:

```tsx
import { connection } from "next/server";
import { EmptyState } from "@/components/empty-state";
import { TaskForm } from "@/components/task-form";
import { TaskSection } from "@/components/task-row";
import { WorkloadChart } from "@/components/workload-chart";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { materializePrepTasks } from "@/db/rules";
import { listTasks } from "@/db/tasks";
import { groupTasks } from "@/lib/deadline-groups";
import { weeklyWorkload } from "@/lib/workload";

export async function DeadlinesData() {
  await connection();
  const db = getDb();
  const now = Date.now();
  materializePrepTasks(db, now);

  const courses = listCourses(db);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const tasks = listTasks(db, { includeDone: true });
  const groups = groupTasks(tasks, now);
  const openCount = groups.overdue.length + groups.thisWeek.length + groups.later.length + groups.noDate.length;
  const sections = [
    { id: "overdue", title: "Overdue", tasks: groups.overdue },
    { id: "this-week", title: "This week", tasks: groups.thisWeek },
    { id: "later", title: "Later", tasks: groups.later },
    { id: "no-date", title: "No date", tasks: groups.noDate },
    { id: "done-recently", title: "Done in the last 7 days", tasks: groups.doneRecently },
  ].filter((s) => s.tasks.length > 0);

  return (
    <div className="space-y-6">
      <TaskForm courses={courses.map((c) => ({ id: c.id, title: c.title }))} />
      {openCount > 0 ? (
        <WorkloadChart weeks={weeklyWorkload(tasks, now)} />
      ) : (
        <EmptyState title="No deadlines yet">Add a task above, or import your ZJU snapshots in Settings.</EmptyState>
      )}
      {sections.map((s) => (
        <TaskSection key={s.id} id={s.id} title={s.title} tasks={s.tasks} courseById={courseById} now={now} />
      ))}
    </div>
  );
}
```

`src/app/deadlines/page.tsx`:

```tsx
import { Suspense } from "react";
import { DeadlinesData } from "@/components/deadlines-data";
import { PageHeader } from "@/components/page-header";

export default function DeadlinesPage() {
  return (
    <>
      <PageHeader title="Deadlines" description="Upcoming and overdue work, and how heavy each week looks." />
      <Suspense fallback={<p className="text-ink-muted">Loading deadlines…</p>}>
        <DeadlinesData />
      </Suspense>
    </>
  );
}
```

In `tests/pages.test.tsx`, add this mock below the existing `@/components/data-folder` mock:

```tsx
vi.mock("@/components/deadlines-data", () => ({
  DeadlinesData: () => <section aria-label="Deadlines stub" />,
}));
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/components/deadlines-data.test.tsx tests/pages.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run all checks, build, and commit**

Run: `npm run check && npm run build`
Expected: all PASS; the build lists `/deadlines` as `◐` (partial prerender) and prints no warnings about `node:sqlite`.

```bash
git add src/components/ui.ts src/lib/labels.ts src/components/field.tsx src/components/course-dot.tsx src/components/task-row.tsx src/components/task-form.tsx src/components/workload-chart.tsx src/components/deadlines-data.tsx src/app/deadlines/page.tsx tests/components/deadlines-data.test.tsx tests/pages.test.tsx
git commit -m "Build the Deadlines page with groups, workload and quick actions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Edit and delete tasks

Imported ZJU tasks arrive without estimates or importance, so the owner needs to fill those in for the priority and workload to be useful.

**Files:**
- Create: `src/components/task-editor.tsx`
- Modify: `src/app/actions.ts` (add `updateTaskAction`), `src/components/task-row.tsx` (render the editor), `tests/components/deadlines-data.test.tsx` (extend the actions mock), `tests/actions.test.ts` (add tests)
- Test: `tests/components/task-editor.test.tsx`

**Interfaces:**
- Consumes: `parseTaskForm` (Task 8), `updateTask` (Task 3), `deleteTaskAction` (Task 8), UI pieces (Task 9), `toLocalDateTimeInput` (Task 1).
- Produces:
  - `updateTaskAction(prev: ActionState, fd: FormData): Promise<ActionState>` — same fields as the task form plus a hidden `id`
  - `TaskEditor({ task })` (client): a collapsed "Edit" panel with title, due, estimate, importance and notes, a Save button and a Delete button. Field ids are prefixed `edit-<task id>-` so many editors can share a page. Type and course are kept through hidden inputs.

- [ ] **Step 1: Write the failing tests**

`tests/components/task-editor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({ updateTaskAction: vi.fn(), deleteTaskAction: vi.fn() }));

import { TaskEditor } from "@/components/task-editor";
import { makeTask } from "../helpers/task";

describe("TaskEditor", () => {
  it("starts collapsed and is filled with the task's current values", () => {
    const task = makeTask({
      id: "t1",
      title: "Lab 1 - Submission",
      type: "assignment",
      courseId: "c1",
      dueAt: Date.parse("2026-10-19T15:59:00Z"),
      estMinutes: 90,
      importance: 3,
      notes: "use NodeXL",
    });
    const { container } = render(<TaskEditor task={task} />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(screen.getByText("Edit")).toHaveAttribute("aria-label", 'Edit "Lab 1 - Submission"');
    expect(screen.getByLabelText("Title")).toHaveValue("Lab 1 - Submission");
    expect(screen.getByLabelText("Due (Beijing time)")).toHaveValue("2026-10-19T23:59");
    expect(screen.getByLabelText("Estimated minutes")).toHaveValue(90);
    expect(screen.getByLabelText("Importance")).toHaveValue("3");
    expect(screen.getByLabelText("Notes")).toHaveValue("use NodeXL");
    expect(container.querySelector('input[name="type"]')).toHaveValue("assignment");
    expect(container.querySelector('input[name="courseId"]')).toHaveValue("c1");
    expect(screen.getByRole("button", { name: "Save", hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete task", hidden: true })).toBeInTheDocument();
  });

  it("leaves the due field empty for an undated task", () => {
    render(<TaskEditor task={makeTask({ id: "t2", dueAt: null })} />);
    expect(screen.getByLabelText("Due (Beijing time)")).toHaveValue("");
  });
});
```

Add to `tests/actions.test.ts`: import `updateTaskAction` next to `createTaskAction`, import `getTask` from `@/db/tasks`, and add inside `describe("task actions", ...)`:

```ts
  it("updates a task's estimate and importance, keeping type and course", async () => {
    await createTaskAction(INITIAL_ACTION_STATE, form({ title: "Lab", type: "assignment", courseId: "", due: "", estMinutes: "", importance: "2", notes: "" }));
    const [task] = listTasks(getDb());
    const state = await updateTaskAction(
      INITIAL_ACTION_STATE,
      form({ id: task.id, title: "Lab 1", type: "assignment", courseId: "", due: "2026-10-19T23:59", estMinutes: "120", importance: "3", notes: "" }),
    );
    expect(state).toMatchObject({ ok: true, message: "Task saved." });
    expect(getTask(getDb(), task.id)).toMatchObject({ title: "Lab 1", estMinutes: 120, importance: 3, dueAt: Date.parse("2026-10-19T15:59:00Z") });
  });

  it("refuses an update with a bad field", async () => {
    await createTaskAction(INITIAL_ACTION_STATE, form({ title: "Lab", type: "assignment", courseId: "", due: "", estMinutes: "", importance: "2", notes: "" }));
    const [task] = listTasks(getDb());
    const state = await updateTaskAction(
      INITIAL_ACTION_STATE,
      form({ id: task.id, title: "Lab", type: "assignment", courseId: "", due: "", estMinutes: "-1", importance: "2", notes: "" }),
    );
    expect(state.ok).toBe(false);
    expect(getTask(getDb(), task.id)?.estMinutes).toBeNull();
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/components/task-editor.test.tsx tests/actions.test.ts`
Expected: FAIL with "Failed to resolve import @/components/task-editor" and "updateTaskAction is not a function" (or an import error for it).

- [ ] **Step 3: Implement**

In `src/app/actions.ts`, add `updateTask` to the `@/db/tasks` import and add after `createTaskAction`:

```ts
export async function updateTaskAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseTaskForm(fd);
  if (!parsed.ok) return failed(parsed, fd);
  const id = idOf(fd);
  if (!id) return { ok: false, message: "This task no longer exists.", nonce: Date.now() };
  updateTask(getDb(), id, parsed.value);
  return done("Task saved.");
}
```

`src/components/task-editor.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { deleteTaskAction, updateTaskAction } from "@/app/actions";
import { FieldError, FormMessage, invalidProps } from "@/components/field";
import { BUTTON_DANGER, BUTTON_PRIMARY, INPUT, LABEL } from "@/components/ui";
import type { Importance, TaskType } from "@/db/tasks";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { IMPORTANCE_LABELS } from "@/lib/labels";
import { toLocalDateTimeInput } from "@/lib/time";

type EditableTask = {
  id: string;
  title: string;
  type: TaskType;
  courseId: string | null;
  dueAt: number | null;
  estMinutes: number | null;
  importance: Importance;
  notes: string | null;
};

export function TaskEditor({ task }: { task: EditableTask }) {
  const [state, action, pending] = useActionState(updateTaskAction, INITIAL_ACTION_STATE);
  const f = `edit-${task.id}`;
  const v: Record<string, string> = state.values ?? {
    title: task.title,
    due: task.dueAt === null ? "" : toLocalDateTimeInput(task.dueAt),
    estMinutes: task.estMinutes === null ? "" : String(task.estMinutes),
    importance: String(task.importance),
    notes: task.notes ?? "",
  };
  const e = state.errors;

  return (
    <details className="mt-2 text-sm">
      <summary aria-label={`Edit "${task.title}"`} className="cursor-pointer text-ink-muted hover:text-ink">
        Edit
      </summary>
      <form key={state.nonce} action={action} noValidate className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="type" value={task.type} />
        <input type="hidden" name="courseId" value={task.courseId ?? ""} />
        <div className="sm:col-span-2">
          <label htmlFor={`${f}-title`} className={LABEL}>
            Title
          </label>
          <input id={`${f}-title`} name="title" defaultValue={v.title} className={INPUT} {...invalidProps(f, "title", e)} />
          <FieldError form={f} name="title" errors={e} />
        </div>
        <div>
          <label htmlFor={`${f}-due`} className={LABEL}>
            Due (Beijing time)
          </label>
          <input id={`${f}-due`} name="due" type="datetime-local" defaultValue={v.due} className={INPUT} {...invalidProps(f, "due", e)} />
          <FieldError form={f} name="due" errors={e} />
        </div>
        <div>
          <label htmlFor={`${f}-estMinutes`} className={LABEL}>
            Estimated minutes
          </label>
          <input
            id={`${f}-estMinutes`}
            name="estMinutes"
            type="number"
            min={1}
            step={5}
            defaultValue={v.estMinutes}
            className={INPUT}
            {...invalidProps(f, "estMinutes", e)}
          />
          <FieldError form={f} name="estMinutes" errors={e} />
        </div>
        <div>
          <label htmlFor={`${f}-importance`} className={LABEL}>
            Importance
          </label>
          <select id={`${f}-importance`} name="importance" defaultValue={v.importance} className={INPUT}>
            {([1, 2, 3] as const).map((n) => (
              <option key={n} value={n}>
                {IMPORTANCE_LABELS[n]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${f}-notes`} className={LABEL}>
            Notes
          </label>
          <textarea id={`${f}-notes`} name="notes" rows={2} defaultValue={v.notes} className={INPUT} {...invalidProps(f, "notes", e)} />
          <FieldError form={f} name="notes" errors={e} />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
            Save
          </button>
          <button type="submit" formAction={deleteTaskAction} formNoValidate className={BUTTON_DANGER}>
            Delete task
          </button>
          <FormMessage state={state} />
        </div>
      </form>
    </details>
  );
}
```

In `src/components/task-row.tsx`, add `import { TaskEditor } from "@/components/task-editor";` and, inside the `min-w-0` div, after the notes line, add:

```tsx
        <TaskEditor task={task} />
```

In `tests/components/deadlines-data.test.tsx`, add `updateTaskAction: vi.fn(),` and `deleteTaskAction: vi.fn(),` to the `@/app/actions` mock.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/components/task-editor.test.tsx tests/actions.test.ts tests/components/deadlines-data.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run all checks and commit**

Run: `npm run check`
Expected: all PASS.

```bash
git add src/app/actions.ts src/components/task-editor.tsx src/components/task-row.tsx tests/components/task-editor.test.tsx tests/actions.test.ts tests/components/deadlines-data.test.tsx
git commit -m "Let tasks be edited and deleted" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Courses pages

**Files:**
- Create: `src/components/course-form.tsx`, `src/components/meeting-form.tsx`, `src/components/rule-form.tsx`, `src/components/courses-data.tsx`, `src/components/course-detail.tsx`, `src/app/courses/[id]/page.tsx`
- Modify: `src/app/courses/page.tsx` (full replace), `tests/pages.test.tsx` (add one mock)
- Test: `tests/components/courses.test.tsx`

**Interfaces:**
- Consumes: repositories (Tasks 3, 4), `describeMeeting` (Task 4), actions (Task 8), UI pieces and `TaskRow` (Tasks 9, 10).
- Produces:
  - `CourseForm({ course?, defaultColor? })` (client). Create mode: section id `new-course`, title input id `course-title`, focuses itself when the hash is `#new-course`. Edit mode: hidden `id`, heading "Edit course".
  - `MeetingForm({ courseId })`, `RuleForm({ courseId })` (client)
  - async `CoursesData()`, async `CourseDetail({ params }: { params: Promise<{ id: string }> })` (calls `notFound()` for an unknown id)

- [ ] **Step 1: Write the failing test**

`tests/components/courses.test.tsx`:

```tsx
// @vitest-environment jsdom
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/app/actions", () => ({
  createCourseAction: vi.fn(),
  updateCourseAction: vi.fn(),
  deleteCourseAction: vi.fn(),
  addMeetingAction: vi.fn(),
  deleteMeetingAction: vi.fn(),
  createRuleAction: vi.fn(),
  deleteRuleAction: vi.fn(),
  setTaskStatusAction: vi.fn(),
  postponeTaskAction: vi.fn(),
  updateTaskAction: vi.fn(),
  deleteTaskAction: vi.fn(),
}));

import { CourseDetail } from "@/components/course-detail";
import { CoursesData } from "@/components/courses-data";
import { getDb } from "@/db/connection";
import { createCourse } from "@/db/courses";
import { addMeetingTime } from "@/db/meetings";
import { createRule } from "@/db/rules";
import { upsertTerm } from "@/db/terms";

const NOW = Date.parse("2026-10-12T04:00:00Z");
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-courses-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

function seed() {
  const db = getDb();
  upsertTerm(db, { id: "t", name: "2026–2027", startDate: "2026-09-14", weeks: 18, periods: [] });
  const course = createCourse(db, { title: "Demo Strategy", code: "2026-13-9000001001", instructor: "Dr. Demo", links: ["https://example.edu/strategy"] }, { now: NOW });
  addMeetingTime(db, { courseId: course.id, termId: "t", weekday: 2, startMinute: 530, endMinute: 745, room: "Hall 1", weeks: [1, 3, 5, 7] });
  return { db, course };
}

describe("CoursesData", () => {
  it("shows an empty state and the add form on first run", async () => {
    render(await CoursesData());
    expect(screen.getByRole("heading", { level: 2, name: "No courses yet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Add a course" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAttribute("id", "course-title");
  });

  it("lists courses with their class times, linking to each course", async () => {
    const { course } = seed();
    render(await CoursesData());
    const link = screen.getByRole("link", { name: /Demo Strategy/ });
    expect(link).toHaveAttribute("href", `/courses/${course.id}`);
    expect(within(link).getByText("Tue 8:50–12:25 · Hall 1 · weeks 1, 3, 5, 7")).toBeInTheDocument();
    expect(within(link).getByText("2026-13-9000001001 · Dr. Demo")).toBeInTheDocument();
  });
});

describe("CourseDetail", () => {
  it("shows the course, its class times, prep routine and prep tasks", async () => {
    const { db, course } = seed();
    createRule(db, { courseId: course.id, title: "Prepare for class", leadMinutes: 720, estMinutes: 45 });
    render(await CourseDetail({ params: Promise.resolve({ id: course.id }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Demo Strategy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://example.edu/strategy" })).toHaveAttribute("target", "_blank");
    const times = screen.getByRole("region", { name: "Class times" });
    expect(within(times).getByText("Tue 8:50–12:25 · Hall 1 · weeks 1, 3, 5, 7")).toBeInTheDocument();
    const routine = screen.getByRole("region", { name: "Prep routine" });
    expect(within(routine).getByText("Prepare for class · due 12 hours before each class · about 45 min")).toBeInTheDocument();
    const tasks = screen.getByRole("region", { name: "Open tasks" });
    expect(within(tasks).getByText("Prepare for class · Tue 13 Oct")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Edit course" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete course" })).toBeInTheDocument();
  });

  it("is not found for an unknown course", async () => {
    await expect(CourseDetail({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/courses.test.tsx`
Expected: FAIL with "Failed to resolve import @/components/course-detail".

- [ ] **Step 3: The three forms**

`src/components/course-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCourseAction, updateCourseAction } from "@/app/actions";
import { FieldError, FormMessage, invalidProps } from "@/components/field";
import { BUTTON_PRIMARY, CARD, INPUT, LABEL } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";

type EditableCourse = {
  id: string;
  title: string;
  code: string | null;
  instructor: string | null;
  semester: string | null;
  color: string;
  links: string[];
  notes: string | null;
};

export function CourseForm({ course, defaultColor = "#2f5d62" }: { course?: EditableCourse; defaultColor?: string }) {
  const [state, action, pending] = useActionState(course ? updateCourseAction : createCourseAction, INITIAL_ACTION_STATE);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (course) return;
    const focusIfAsked = () => {
      if (window.location.hash === "#new-course") titleRef.current?.focus();
    };
    focusIfAsked();
    window.addEventListener("hashchange", focusIfAsked);
    return () => window.removeEventListener("hashchange", focusIfAsked);
  }, [course]);

  const saved = course
    ? {
        title: course.title,
        code: course.code ?? "",
        instructor: course.instructor ?? "",
        semester: course.semester ?? "",
        color: course.color,
        links: course.links.join("\n"),
        notes: course.notes ?? "",
      }
    : { color: defaultColor };
  const v: Record<string, string> = state.values ?? saved;
  const e = state.errors;

  return (
    <section id={course ? "edit-course" : "new-course"} aria-labelledby="course-form-heading" className={CARD}>
      <h2 id="course-form-heading" className="font-serif text-lg">
        {course ? "Edit course" : "Add a course"}
      </h2>
      <form key={state.nonce} action={action} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
        {course && <input type="hidden" name="id" value={course.id} />}
        <div className="sm:col-span-2">
          <label htmlFor="course-title" className={LABEL}>
            Title
          </label>
          <input ref={titleRef} id="course-title" name="title" defaultValue={v.title} className={INPUT} {...invalidProps("course", "title", e)} />
          <FieldError form="course" name="title" errors={e} />
        </div>
        <div>
          <label htmlFor="course-code" className={LABEL}>
            Course code
          </label>
          <input id="course-code" name="code" defaultValue={v.code} className={INPUT} />
        </div>
        <div>
          <label htmlFor="course-instructor" className={LABEL}>
            Instructor
          </label>
          <input id="course-instructor" name="instructor" defaultValue={v.instructor} className={INPUT} />
        </div>
        <div>
          <label htmlFor="course-semester" className={LABEL}>
            Semester
          </label>
          <input id="course-semester" name="semester" defaultValue={v.semester} className={INPUT} />
        </div>
        <div>
          <label htmlFor="course-color" className={LABEL}>
            Color
          </label>
          <input id="course-color" name="color" type="color" defaultValue={v.color} className="mt-1 h-10 w-16 rounded-md border border-line bg-paper" {...invalidProps("course", "color", e)} />
          <FieldError form="course" name="color" errors={e} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="course-links" className={LABEL}>
            Links (one per line)
          </label>
          <textarea id="course-links" name="links" rows={2} defaultValue={v.links} className={INPUT} {...invalidProps("course", "links", e)} />
          <FieldError form="course" name="links" errors={e} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="course-notes" className={LABEL}>
            Notes
          </label>
          <textarea id="course-notes" name="notes" rows={2} defaultValue={v.notes} className={INPUT} />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
            {pending ? "Saving…" : course ? "Save changes" : "Add course"}
          </button>
          <FormMessage state={state} />
        </div>
      </form>
    </section>
  );
}
```

`src/components/meeting-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { addMeetingAction } from "@/app/actions";
import { FieldError, FormMessage, invalidProps } from "@/components/field";
import { BUTTON_SECONDARY, INPUT, LABEL } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { WEEKDAY_LABELS } from "@/lib/labels";

export function MeetingForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(addMeetingAction, INITIAL_ACTION_STATE);
  const v = state.values ?? {};
  const e = state.errors;
  return (
    <form key={state.nonce} action={action} noValidate className="mt-4 grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div>
        <label htmlFor="meeting-weekday" className={LABEL}>
          Day
        </label>
        <select id="meeting-weekday" name="weekday" defaultValue={v.weekday ?? "1"} className={INPUT} {...invalidProps("meeting", "weekday", e)}>
          {WEEKDAY_LABELS.map((label, i) => (
            <option key={label} value={i + 1}>
              {label}
            </option>
          ))}
        </select>
        <FieldError form="meeting" name="weekday" errors={e} />
      </div>
      <div>
        <label htmlFor="meeting-start" className={LABEL}>
          Starts
        </label>
        <input id="meeting-start" name="start" type="time" defaultValue={v.start} className={INPUT} {...invalidProps("meeting", "start", e)} />
        <FieldError form="meeting" name="start" errors={e} />
      </div>
      <div>
        <label htmlFor="meeting-end" className={LABEL}>
          Ends
        </label>
        <input id="meeting-end" name="end" type="time" defaultValue={v.end} className={INPUT} {...invalidProps("meeting", "end", e)} />
        <FieldError form="meeting" name="end" errors={e} />
      </div>
      <div>
        <label htmlFor="meeting-room" className={LABEL}>
          Room
        </label>
        <input id="meeting-room" name="room" defaultValue={v.room} className={INPUT} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
        <button type="submit" disabled={pending} className={BUTTON_SECONDARY}>
          Add class time
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
```

`src/components/rule-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { createRuleAction } from "@/app/actions";
import { FieldError, FormMessage, invalidProps } from "@/components/field";
import { BUTTON_SECONDARY, INPUT, LABEL } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { IMPORTANCE_LABELS } from "@/lib/labels";

export function RuleForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(createRuleAction, INITIAL_ACTION_STATE);
  const v = state.values ?? {};
  const e = state.errors;
  return (
    <form key={state.nonce} action={action} noValidate className="mt-4 grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="sm:col-span-4">
        <label htmlFor="rule-title" className={LABEL}>
          Task name
        </label>
        <input id="rule-title" name="title" placeholder="Prepare for class" defaultValue={v.title} className={INPUT} />
      </div>
      <div>
        <label htmlFor="rule-leadHours" className={LABEL}>
          Hours before class
        </label>
        <input id="rule-leadHours" name="leadHours" type="number" min={0} step={0.5} defaultValue={v.leadHours ?? "12"} className={INPUT} {...invalidProps("rule", "leadHours", e)} />
        <FieldError form="rule" name="leadHours" errors={e} />
      </div>
      <div>
        <label htmlFor="rule-estMinutes" className={LABEL}>
          Minutes needed
        </label>
        <input id="rule-estMinutes" name="estMinutes" type="number" min={1} step={5} defaultValue={v.estMinutes ?? "45"} className={INPUT} {...invalidProps("rule", "estMinutes", e)} />
        <FieldError form="rule" name="estMinutes" errors={e} />
      </div>
      <div>
        <label htmlFor="rule-importance" className={LABEL}>
          Importance
        </label>
        <select id="rule-importance" name="importance" defaultValue={v.importance ?? "2"} className={INPUT}>
          {([1, 2, 3] as const).map((n) => (
            <option key={n} value={n}>
              {IMPORTANCE_LABELS[n]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
        <button type="submit" disabled={pending} className={BUTTON_SECONDARY}>
          Add prep routine
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Data components and pages**

`src/components/courses-data.tsx`:

```tsx
import Link from "next/link";
import { connection } from "next/server";
import { CourseDot } from "@/components/course-dot";
import { CourseForm } from "@/components/course-form";
import { EmptyState } from "@/components/empty-state";
import { CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { COURSE_COLORS, listCourses } from "@/db/courses";
import { listMeetingTimes } from "@/db/meetings";
import { describeMeeting } from "@/lib/sessions";

export async function CoursesData() {
  await connection();
  const db = getDb();
  const courses = listCourses(db);
  const meetings = listMeetingTimes(db);

  return (
    <div className="space-y-6">
      {courses.length === 0 ? (
        <EmptyState title="No courses yet">Add a course below, or import your ZJU snapshots in Settings.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <li key={course.id}>
              <Link
                href={`/courses/${course.id}`}
                className={`block h-full ${CARD} hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
              >
                <span className="flex items-center gap-2 font-serif text-lg">
                  <CourseDot color={course.color} />
                  {course.title}
                </span>
                <span className="mt-1 block text-sm text-ink-muted">
                  {[course.code, course.instructor].filter(Boolean).join(" · ") || "No details yet"}
                </span>
                {meetings
                  .filter((m) => m.courseId === course.id)
                  .map((m) => (
                    <span key={m.id} className="mt-1 block text-sm">
                      {describeMeeting(m)}
                    </span>
                  ))}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CourseForm defaultColor={COURSE_COLORS[courses.length % COURSE_COLORS.length]} />
    </div>
  );
}
```

`src/components/course-detail.tsx`:

```tsx
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { deleteCourseAction, deleteMeetingAction, deleteRuleAction } from "@/app/actions";
import { CourseDot } from "@/components/course-dot";
import { CourseForm } from "@/components/course-form";
import { MeetingForm } from "@/components/meeting-form";
import { RuleForm } from "@/components/rule-form";
import { TaskRow } from "@/components/task-row";
import { BUTTON_DANGER, BUTTON_SECONDARY, CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { getCourse } from "@/db/courses";
import { listMeetingTimes } from "@/db/meetings";
import { listRules, materializePrepTasks, type RecurrenceRule } from "@/db/rules";
import { listTasks } from "@/db/tasks";
import { describeMeeting } from "@/lib/sessions";
import { MINUTE_MS, humanDuration } from "@/lib/time";

function describeRule(rule: RecurrenceRule): string {
  const when = rule.leadMinutes === 0 ? "due when class starts" : `due ${humanDuration(rule.leadMinutes * MINUTE_MS)} before each class`;
  const parts = [rule.title, when];
  if (rule.estMinutes !== null) parts.push(`about ${humanDuration(rule.estMinutes * MINUTE_MS)}`);
  return parts.join(" · ");
}

export async function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const db = getDb();
  const course = getCourse(db, id);
  if (!course) notFound();

  const now = Date.now();
  materializePrepTasks(db, now);
  const meetings = listMeetingTimes(db, id);
  const rules = listRules(db, id);
  const tasks = listTasks(db, { courseId: id });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-3 font-serif text-3xl tracking-tight">
          <CourseDot color={course.color} size="lg" />
          {course.title}
        </h1>
        <p className="mt-2 text-ink-muted">{[course.code, course.instructor, course.semester].filter(Boolean).join(" · ")}</p>
        {course.links.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {course.links.map((link) => (
              <li key={link}>
                <a href={link} target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        )}
        {course.notes && <p className="mt-2 max-w-prose text-sm">{course.notes}</p>}
      </header>

      <section aria-labelledby="meetings-heading" className={CARD}>
        <h2 id="meetings-heading" className="font-serif text-lg">
          Class times
        </h2>
        {meetings.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No class times yet.</p>
        ) : (
          <ul className="mt-2">
            {meetings.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
                <span>{describeMeeting(m)}</span>
                <form action={deleteMeetingAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" className={BUTTON_SECONDARY} aria-label={`Remove class time ${describeMeeting(m)}`}>
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <MeetingForm courseId={course.id} />
      </section>

      <section aria-labelledby="rules-heading" className={CARD}>
        <h2 id="rules-heading" className="font-serif text-lg">
          Prep routine
        </h2>
        <p className="mt-2 text-sm text-ink-muted">Creates a prep task before each class, for the next two weeks.</p>
        {rules.length > 0 && (
          <ul className="mt-2">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
                <span>{describeRule(rule)}</span>
                <form action={deleteRuleAction}>
                  <input type="hidden" name="id" value={rule.id} />
                  <button type="submit" className={BUTTON_SECONDARY} aria-label={`Remove prep routine ${rule.title}`}>
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <RuleForm courseId={course.id} />
      </section>

      <section aria-labelledby="course-tasks-heading" className={CARD}>
        <h2 id="course-tasks-heading" className="font-serif text-lg">
          Open tasks
        </h2>
        {tasks.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No open tasks.</p>
        ) : (
          <ul className="mt-2">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} course={course} now={now} />
            ))}
          </ul>
        )}
      </section>

      <CourseForm course={course} />

      <section aria-labelledby="delete-course-heading" className={CARD}>
        <h2 id="delete-course-heading" className="font-serif text-lg">
          Delete course
        </h2>
        <p className="mt-2 text-sm text-ink-muted">Deletes the course and its class times. Its tasks stay, without a course.</p>
        <form action={deleteCourseAction} className="mt-3">
          <input type="hidden" name="id" value={course.id} />
          <button type="submit" className={BUTTON_DANGER}>
            Delete course
          </button>
        </form>
      </section>
    </div>
  );
}
```

`src/app/courses/page.tsx`:

```tsx
import { Suspense } from "react";
import { CoursesData } from "@/components/courses-data";
import { PageHeader } from "@/components/page-header";

export default function CoursesPage() {
  return (
    <>
      <PageHeader title="Courses" description="Your courses this semester, with times, instructors, and links." />
      <Suspense fallback={<p className="text-ink-muted">Loading courses…</p>}>
        <CoursesData />
      </Suspense>
    </>
  );
}
```

`src/app/courses/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { CourseDetail } from "@/components/course-detail";

export default function CoursePage({ params }: PageProps<"/courses/[id]">) {
  return (
    <>
      <p className="mb-4 text-sm">
        <Link href="/courses" className="text-ink-muted hover:text-ink">
          ← All courses
        </Link>
      </p>
      <Suspense fallback={<p className="text-ink-muted">Loading course…</p>}>
        <CourseDetail params={params} />
      </Suspense>
    </>
  );
}
```

In `tests/pages.test.tsx`, add this mock below the `@/components/deadlines-data` mock:

```tsx
vi.mock("@/components/courses-data", () => ({
  CoursesData: () => <section aria-label="Courses stub" />,
}));
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/components/courses.test.tsx tests/pages.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run all checks and commit**

Run: `npm run check`
Expected: all PASS.

```bash
git add src/components/course-form.tsx src/components/meeting-form.tsx src/components/rule-form.tsx src/components/courses-data.tsx src/components/course-detail.tsx "src/app/courses/[id]/page.tsx" src/app/courses/page.tsx tests/components/courses.test.tsx tests/pages.test.tsx
git commit -m "Build the Courses pages with class times and prep routines" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Today page and snapshot import in Settings

**Files:**
- Create: `src/lib/today.ts`, `src/components/today-data.tsx`, `src/components/import-panel.tsx`, `src/components/import-section.tsx`
- Modify: `src/app/today/page.tsx` (full replace), `src/app/settings/page.tsx`, `tests/pages.test.tsx`
- Test: `tests/lib/today.test.ts`, `tests/components/today-data.test.tsx`, `tests/components/import-section.test.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `@/lib/today`: `type TodayView = { dueNext: Task[]; overdueCount: number; nextSession: ClassSession | null; prepTask: Task | null; top: ScoredTask | null }`, `buildToday(tasks: Task[], sessions: ClassSession[], now: number): TodayView`
  - async `TodayData()`: the four Today cards, with the same `h2` titles as M0 ("Due next", "Prepare next", "Highest-leverage task", "Confusing concepts")
  - `ImportPanel({ files })` (client), async `ImportSection()`

- [ ] **Step 1: Write the failing tests**

`tests/lib/today.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ClassSession } from "@/lib/sessions";
import { DAY_MS, HOUR_MS } from "@/lib/time";
import { buildToday } from "@/lib/today";
import { makeTask } from "../helpers/task";

const NOW = Date.parse("2026-10-12T04:00:00Z");

const session = (overrides: Partial<ClassSession>): ClassSession => ({
  courseId: "c1",
  meetingTimeId: "m1",
  week: 5,
  startsAt: NOW + 20 * HOUR_MS,
  endsAt: NOW + 23 * HOUR_MS,
  room: "Hall 1",
  ...overrides,
});

describe("buildToday", () => {
  it("lists the next three deadlines and counts overdue ones", () => {
    const tasks = [
      makeTask({ title: "late", dueAt: NOW - DAY_MS }),
      makeTask({ title: "d3", dueAt: NOW + 3 * DAY_MS }),
      makeTask({ title: "d1", dueAt: NOW + DAY_MS }),
      makeTask({ title: "d4", dueAt: NOW + 4 * DAY_MS }),
      makeTask({ title: "d2", dueAt: NOW + 2 * DAY_MS }),
      makeTask({ title: "finished", dueAt: NOW + HOUR_MS, status: "done" }),
    ];
    const view = buildToday(tasks, [], NOW);
    expect(view.dueNext.map((t) => t.title)).toEqual(["d1", "d2", "d3"]);
    expect(view.overdueCount).toBe(1);
    expect(view.top?.task.title).toBe("late");
  });

  it("finds the next class and its prep task", () => {
    const next = session({});
    const prep = makeTask({ type: "prep", courseId: "c1", occurrenceKey: String(next.startsAt), dueAt: next.startsAt - 12 * HOUR_MS });
    const view = buildToday([prep], [session({ startsAt: NOW - HOUR_MS }), next], NOW);
    expect(view.nextSession).toBe(next);
    expect(view.prepTask).toBe(prep);
  });

  it("handles an empty start", () => {
    expect(buildToday([], [], NOW)).toEqual({ dueNext: [], overdueCount: 0, nextSession: null, prepTask: null, top: null });
  });
});
```

`tests/components/today-data.test.tsx`:

```tsx
// @vitest-environment jsdom
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { TodayData } from "@/components/today-data";
import { getDb } from "@/db/connection";
import { importSnapshots } from "@/import/run";

const NOW = Date.parse("2026-10-12T04:00:00Z"); // Mon 12 Oct, 12:00 Shanghai
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-today-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

const card = (name: string) => screen.getByRole("heading", { level: 2, name }).closest("section") as HTMLElement;

describe("TodayData", () => {
  it("answers the four daily questions with empty states on first run", async () => {
    render(await TodayData());
    for (const name of ["Due next", "Prepare next", "Highest-leverage task", "Confusing concepts"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(within(card("Due next")).getByText(/Nothing due yet/)).toBeInTheDocument();
  });

  it("fills the cards from imported data", async () => {
    const snapshots = path.join(dir, "snapshots");
    mkdirSync(snapshots);
    copyFileSync("sample-data/courses-zju-sample.json", path.join(snapshots, "courses-zju-2026-10-12.json"));
    copyFileSync("sample-data/timetable-yjsy-sample.json", path.join(snapshots, "timetable-yjsy-2026-10-12.json"));
    importSnapshots(getDb(), snapshots, NOW);

    render(await TodayData());

    const due = card("Due next");
    expect(within(due).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent)).toEqual([
      "Characters L2",
      "Forum: Discussion week 5",
      "Quiz 1",
    ]);

    const prepare = card("Prepare next");
    expect(within(prepare).getByText("Demo Strategy")).toBeInTheDocument();
    expect(within(prepare).getByText("Tomorrow 8:50 · Demo Hall 101")).toBeInTheDocument();
    expect(within(prepare).getByRole("link", { name: "Add a prep routine" })).toBeInTheDocument();

    const top = card("Highest-leverage task");
    expect(within(top).getByText("Characters L2")).toBeInTheDocument();
    expect(within(top).getByText("Due Wed 12:00")).toBeInTheDocument();
  });
});
```

`tests/components/import-section.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/lib/today.test.ts tests/components/today-data.test.tsx tests/components/import-section.test.tsx`
Expected: FAIL with "Failed to resolve import @/lib/today" / "@/components/today-data" / "@/components/import-section".

- [ ] **Step 3: Implement Today**

`src/lib/today.ts`:

```ts
import { isOpen, type Task } from "@/db/tasks";
import { rankTasks, type ScoredTask } from "@/lib/priority";
import type { ClassSession } from "@/lib/sessions";

export type TodayView = {
  dueNext: Task[];
  overdueCount: number;
  nextSession: ClassSession | null;
  prepTask: Task | null;
  top: ScoredTask | null;
};

export function buildToday(tasks: Task[], sessions: ClassSession[], now: number): TodayView {
  const open = tasks.filter(isOpen);
  const dueNext = open
    .filter((t): t is Task & { dueAt: number } => t.dueAt !== null && t.dueAt >= now)
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, 3);
  const overdueCount = open.filter((t) => t.dueAt !== null && t.dueAt < now).length;
  const nextSession = sessions.find((s) => s.startsAt > now) ?? null;
  const prepTask = nextSession
    ? (open.find((t) => t.type === "prep" && t.courseId === nextSession.courseId && t.occurrenceKey === String(nextSession.startsAt)) ?? null)
    : null;
  return { dueNext, overdueCount, nextSession, prepTask, top: rankTasks(open, now)[0] ?? null };
}
```

`src/components/today-data.tsx`:

```tsx
import Link from "next/link";
import { connection } from "next/server";
import { CourseDot } from "@/components/course-dot";
import { EmptyState } from "@/components/empty-state";
import { CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { listCourses, type Course } from "@/db/courses";
import { listMeetingTimes } from "@/db/meetings";
import { materializePrepTasks } from "@/db/rules";
import { listTasks } from "@/db/tasks";
import { listTerms } from "@/db/terms";
import { sessionsBetween } from "@/lib/sessions";
import { DAY_MS, formatDue } from "@/lib/time";
import { buildToday } from "@/lib/today";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={CARD}>
      <h2 className="font-serif text-lg">{title}</h2>
      {children}
    </section>
  );
}

function CourseName({ course }: { course: Course | null }) {
  if (!course) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <CourseDot color={course.color} />
      {course.title}
    </span>
  );
}

export async function TodayData() {
  await connection();
  const db = getDb();
  const now = Date.now();
  materializePrepTasks(db, now);

  const courses = new Map(listCourses(db).map((c) => [c.id, c]));
  const courseOf = (id: string | null) => (id ? (courses.get(id) ?? null) : null);
  const sessions = sessionsBetween(listMeetingTimes(db), listTerms(db), now, now + 7 * DAY_MS);
  const view = buildToday(listTasks(db), sessions, now);
  const nextCourse = view.nextSession ? courseOf(view.nextSession.courseId) : null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {view.dueNext.length === 0 && view.overdueCount === 0 ? (
        <EmptyState title="Due next">Nothing due yet. Add a course or a deadline and it will show here.</EmptyState>
      ) : (
        <Card title="Due next">
          {view.overdueCount > 0 && (
            <p className="mt-2 text-sm font-medium text-warn">
              <Link href="/deadlines" className="underline underline-offset-2">
                {view.overdueCount} overdue
              </Link>
            </p>
          )}
          <ul className="mt-2 space-y-3">
            {view.dueNext.map((task) => (
              <li key={task.id}>
                <p className="font-medium">{task.title}</p>
                <p className="flex flex-wrap gap-x-3 text-sm text-ink-muted">
                  <CourseName course={courseOf(task.courseId)} />
                  <span>{formatDue(task.dueAt as number, now)}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {view.nextSession && nextCourse ? (
        <Card title="Prepare next">
          <p className="mt-2 font-medium">
            <CourseName course={nextCourse} />
          </p>
          <p className="text-sm text-ink-muted">
            {[formatDue(view.nextSession.startsAt, now), view.nextSession.room].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-3 text-sm">
            {view.prepTask ? (
              `Prep task due ${formatDue(view.prepTask.dueAt as number, now)}`
            ) : (
              <Link href={`/courses/${nextCourse.id}`} className="underline underline-offset-2">
                Add a prep routine
              </Link>
            )}
          </p>
        </Card>
      ) : (
        <EmptyState title="Prepare next">
          Your next class will show here. Add class times to a course, or import your ZJU timetable in Settings.
        </EmptyState>
      )}

      {view.top ? (
        <Card title="Highest-leverage task">
          <p className="mt-2 font-medium">{view.top.task.title}</p>
          <p className="text-sm text-ink-muted">
            <CourseName course={courseOf(view.top.task.courseId)} />
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-ink-muted">
            {view.top.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="Highest-leverage task">The one task worth doing first today, with the reason, will show here.</EmptyState>
      )}

      <EmptyState title="Confusing concepts">Concepts you mark as confusing in Prepare Class will collect here.</EmptyState>
    </div>
  );
}
```

`src/app/today/page.tsx`:

```tsx
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { TodayData } from "@/components/today-data";

export default function TodayPage() {
  return (
    <>
      <PageHeader title="Today" description="What is due, what to prepare, and where to put your best hour." />
      <Suspense fallback={<p className="text-ink-muted">Loading today…</p>}>
        <TodayData />
      </Suspense>
    </>
  );
}
```

- [ ] **Step 4: Implement the import section**

`src/components/import-panel.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { importSnapshotsAction } from "@/app/actions";
import { FormMessage } from "@/components/field";
import { BUTTON_PRIMARY } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";

export function ImportPanel({ files }: { files: string[] }) {
  const [state, action, pending] = useActionState(importSnapshotsAction, INITIAL_ACTION_STATE);
  return (
    <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending || files.length === 0} className={BUTTON_PRIMARY}>
        {pending ? "Importing…" : "Import ZJU snapshots"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
```

`src/components/import-section.tsx`:

```tsx
import path from "node:path";
import { connection } from "next/server";
import { ImportPanel } from "@/components/import-panel";
import { CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { lastImport, listSnapshotFiles } from "@/import/run";
import { DataDirError, getDataDir } from "@/lib/data-dir";
import { formatDue } from "@/lib/time";

function snapshotsDir(): string | null {
  try {
    return path.join(getDataDir(), "snapshots");
  } catch (error) {
    if (error instanceof DataDirError) return null;
    throw error;
  }
}

export async function ImportSection() {
  await connection();
  const dir = snapshotsDir();
  if (!dir) return null; // The data folder card already explains the problem.

  const files = listSnapshotFiles(dir);
  const last = lastImport(getDb());

  return (
    <section aria-labelledby="import-heading" className={CARD}>
      <h2 id="import-heading" className="font-serif text-lg">
        ZJU snapshots
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        Saved copies of your ZJU courses, deadlines and timetable, kept in <span className="font-mono">{dir}</span>. Importing adds
        new items and updates titles and dates. It never undoes your own edits.
      </p>
      {files.length ? (
        <ul className="mt-3 space-y-1 font-mono text-sm">
          {files.map((file) => (
            <li key={file}>{file}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm">No snapshot files yet.</p>
      )}
      <p className="mt-3 text-sm text-ink-muted">
        {last ? `Last import: ${formatDue(last.importedAt, Date.now())} (${last.fileName})` : "Not imported yet."}
      </p>
      <ImportPanel files={files} />
    </section>
  );
}
```

In `src/app/settings/page.tsx`, add the import below the `DataFolder` import:

```tsx
import { ImportSection } from "@/components/import-section";
```

and add this block between the data-folder `</Suspense>` and `<IntegrityNote />`:

```tsx
        <Suspense fallback={null}>
          <ImportSection />
        </Suspense>
```

In `tests/pages.test.tsx`:
- add these mocks below the `@/components/courses-data` mock:

```tsx
vi.mock("@/components/today-data", () => ({
  TodayData: () => <section aria-label="Today stub" />,
}));
vi.mock("@/components/import-section", () => ({
  ImportSection: () => null,
}));
```

- delete the test `it("Today answers the four daily questions", ...)` (it now lives in `tests/components/today-data.test.tsx`).

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/lib/today.test.ts tests/components/today-data.test.tsx tests/components/import-section.test.tsx tests/pages.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run all checks and commit**

Run: `npm run check`
Expected: all PASS.

```bash
git add src/lib/today.ts src/components/today-data.tsx src/components/import-panel.tsx src/components/import-section.tsx src/app/today/page.tsx src/app/settings/page.tsx tests/lib/today.test.ts tests/components/today-data.test.tsx tests/components/import-section.test.tsx tests/pages.test.tsx
git commit -m "Fill Today from real data and add snapshot import to Settings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Keyboard shortcuts and docs

**Files:**
- Create: `src/components/shortcuts.tsx`
- Modify: `src/app/layout.tsx`, `README.md`, `docs/ARCHITECTURE.md`, `docs/PRIVACY.md`, `docs/data-sources.md`
- Test: `tests/components/shortcuts.test.tsx`

**Interfaces:**
- Consumes: input ids `task-title` (Task 9) and `course-title` (Task 11), hashes `#new-task` / `#new-course`.
- Produces: `SHORTCUTS`, `isTypingTarget(target)`, `Shortcuts()` (client, rendered once in the layout).

Shortcuts: `n` new task, `c` new course, `t` Today, `d` Deadlines, `?` show or hide the list. Ignored while typing in a field or when Cmd, Ctrl or Alt is held.

- [ ] **Step 1: Write the failing test**

`tests/components/shortcuts.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/shortcuts.test.tsx`
Expected: FAIL with "Failed to resolve import @/components/shortcuts".

- [ ] **Step 3: Implement**

`src/components/shortcuts.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef } from "react";
import { BUTTON_SECONDARY } from "@/components/ui";

export const SHORTCUTS = [
  { key: "n", label: "New task", href: "/deadlines#new-task", focusId: "task-title" },
  { key: "c", label: "New course", href: "/courses#new-course", focusId: "course-title" },
  { key: "t", label: "Go to Today", href: "/today", focusId: null },
  { key: "d", label: "Go to Deadlines", href: "/deadlines", focusId: null },
] as const;

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function Shortcuts() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;

      if (event.key === "?") {
        event.preventDefault();
        const dialog = dialogRef.current;
        if (!dialog) return;
        // jsdom and older browsers may lack showModal/close; fall back to the attribute.
        if (dialog.open) {
          if (typeof dialog.close === "function") dialog.close();
          else dialog.removeAttribute("open");
        } else if (typeof dialog.showModal === "function") {
          dialog.showModal();
        } else {
          dialog.setAttribute("open", "");
        }
        return;
      }

      const shortcut = SHORTCUTS.find((s) => s.key === event.key);
      if (!shortcut) return;
      event.preventDefault();
      // Focus the form only on its own page; elsewhere (e.g. a course's edit form) go to that page.
      const [path] = shortcut.href.split("#");
      const field = shortcut.focusId && window.location.pathname === path ? document.getElementById(shortcut.focusId) : null;
      if (field) {
        field.focus();
        field.scrollIntoView?.({ block: "center" });
      } else {
        router.push(shortcut.href);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="shortcuts-heading"
      className="m-auto rounded-lg border border-line bg-surface p-6 text-ink backdrop:bg-black/30"
    >
      <h2 id="shortcuts-heading" className="font-serif text-lg">
        Keyboard shortcuts
      </h2>
      <dl className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
        {[...SHORTCUTS, { key: "?", label: "Show or hide this list" }].map((s) => (
          <Fragment key={s.key}>
            <dt>
              <kbd className="rounded border border-line px-1.5 font-mono">{s.key}</kbd>
            </dt>
            <dd>{s.label}</dd>
          </Fragment>
        ))}
      </dl>
      <form method="dialog" className="mt-4">
        <button type="submit" className={BUTTON_SECONDARY}>
          Close
        </button>
      </form>
    </dialog>
  );
}
```

In `src/app/layout.tsx`, add the import below the `IntegrityBanner` import:

```tsx
import { Shortcuts } from "@/components/shortcuts";
```

Inside `<header>`, after `<Nav />`, add:

```tsx
            <p className="mt-6 hidden text-xs text-ink-muted md:block">
              Press <kbd className="rounded border border-line px-1 font-mono">?</kbd> for shortcuts
            </p>
```

and just before `</body>` add `<Shortcuts />`.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/components/shortcuts.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update the docs**

`README.md`:
- In "Privacy", add a line after the `DATA_DIR` line: `- The database is one SQLite file, DATA_DIR/study.db, readable only by you.`
- Add a section after "Setup":

```markdown
## Your ZJU data

The app reads saved snapshots of your Courses@ZJU data and graduate-system timetable from `DATA_DIR/snapshots/` (`courses-zju-YYYY-MM-DD.json`, `timetable-yjsy-YYYY-MM-DD.json`). Open **Settings → ZJU snapshots → Import**. Importing again later adds new items and updates titles and dates, but keeps your own edits (titles you renamed, importance, estimates, notes, done tasks).

Fake examples of both files are in `sample-data/`. Automatic sync from ZJU arrives in the sync milestone.
```

- In "Roadmap", change the rows to:

```markdown
| M0 Foundation: app shell, privacy guards, docs | Done |
| M1 Courses and Deadlines, snapshot import | Done |
| Sync: Courses@ZJU and timetable, read-only | Next |
| M2 Materials: upload, extract, view, download from Courses@ZJU | Planned |
| M4 AI and Class Ready Brief | Planned |
| M5 Professor Mode | Planned |
| M6 Research workspace | Planned |
| M7 Weekly Review and polish | Planned |
```

`docs/ARCHITECTURE.md`: replace the code block and the "Planned additions" paragraph with:

````markdown
```
src/app/          routes; one per screen, plus /courses/[id]
src/app/actions.ts  server actions (validate with src/lib/forms.ts, write, refresh)
src/components/   UI; *-data.tsx are async server components that read the database
src/db/           SQLite (node:sqlite): connection + migrations, one module per table group
src/import/       snapshot schemas (Zod), mapping, and the import runner
src/lib/          pure logic: time (Shanghai), sessions, recurrence, priority, workload, forms
tests/            Vitest tests; tests/helpers has an in-memory database and a task factory
sample-data/      fake snapshots used by tests
```

Rules:
- Every database read in a page happens inside `<Suspense>` after `await connection()`, because Cache Components is on and would otherwise run the read at build time.
- Client components never import `src/db/*` or `src/import/*` values (they pull in `node:sqlite`); type-only imports are fine.
- Times are UTC milliseconds in storage and Shanghai time on screen (`src/lib/time.ts`).

Planned additions: `src/extract/` (PDF and PPTX, M2), `src/sync/` (Playwright), `src/ai/` (provider interface and Claude adapter, M4).
````

`docs/PRIVACY.md`, in "What stays on your Mac", change "the SQLite database" to "the SQLite database (`study.db`, mode `0600`)" and add "saved ZJU snapshots (`snapshots/`)" to the list.

`docs/data-sources.md`, at the end of the "Mapping to our model" list under Courses@ZJU, add:

```markdown
- Implemented in `src/import/tronclass.ts`. Items that are not on the to-do list and already past are skipped; future ones get a note saying so.
```

and under the graduate system's mapping list:

```markdown
- Implemented in `src/import/yjsy.ts` and `src/import/run.ts`.
```

- [ ] **Step 6: Run all checks and build**

Run: `npm run check && npm run build`
Expected: all PASS. The build lists `/today`, `/courses`, `/deadlines`, `/settings` and `/courses/[id]` as `◐` or `ƒ`, and no warnings.

- [ ] **Step 7: Commit**

```bash
git add src/components/shortcuts.tsx src/app/layout.tsx tests/components/shortcuts.test.tsx README.md docs/ARCHITECTURE.md docs/PRIVACY.md docs/data-sources.md
git commit -m "Add keyboard shortcuts and update docs for M1" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: English names for ZJU data, and a real-data check

The owner asked for the app to show ZJU data in English (2026-10-12).

**Files:**
- Create: `src/import/translate.ts`, `src/import/errors.ts`
- Modify: `src/import/run.ts`, `README.md`
- Test: `tests/import/translate.test.ts`, `tests/import/run.test.ts` (add tests)

**Interfaces:**
- Consumes: `importSnapshots` and `ImportError` (Task 7; `ImportError` moves to `src/import/errors.ts` here).
- Produces:
  - `translateSemester(value: string | null): string | null` (`"2026-2027秋冬"` → `"2026–2027 Autumn–Winter"`)
  - `translatePlace(value: string | null): string | null` (rooms and buildings: `"紫金港西2-103"` → `"Zijingang West 2-103"`)
  - `translateNote(value: string | null): string | null` (room notes: `"管理学院C110（10月23日在B211）2026级PIEGL"` → `"School of Management C110 (23 Oct in B211) 2026 PIEGL cohort"`)
  - `COURSE_NAMES_FILE = "course-names.json"`, `loadCourseNames(dir: string): Record<string, string>` (reads `DATA_DIR/snapshots/course-names.json`, a map from the ZJU title to the English title; missing file → `{}`; bad file → `ImportError`)

Rules:
- Course titles go through the names file on create. On re-import, a course whose title still equals its original ZJU title gets the English title; a course the owner renamed keeps its name.
- Semesters, rooms and room notes are translated with the small, fixed word lists in `translate.ts`. Words the lists do not know stay as they are.
- Task titles are no longer refreshed on re-import, so a task the owner translated or renamed keeps its title. Due dates and courses still refresh.
- Instructor names are left as written.
- The names file holds the owner's real course names, so it lives only in `DATA_DIR/snapshots/`, never in the repo.

- [ ] **Step 1: Write the failing tests**

`tests/import/translate.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ImportError } from "@/import/run";
import { COURSE_NAMES_FILE, loadCourseNames, translateNote, translatePlace, translateSemester } from "@/import/translate";

describe("translateSemester", () => {
  it("names the seasons in English", () => {
    expect(translateSemester("2026-2027秋")).toBe("2026–2027 Autumn");
    expect(translateSemester("2026-2027秋冬")).toBe("2026–2027 Autumn–Winter");
    expect(translateSemester("2026-2027 Autumn")).toBe("2026–2027 Autumn");
    expect(translateSemester(null)).toBeNull();
  });
});

describe("translatePlace", () => {
  it("translates campus, direction, building and numbers", () => {
    expect(translatePlace("紫金港西2-103")).toBe("Zijingang West 2-103");
    expect(translatePlace("紫金港北4-410")).toBe("Zijingang North 4-410");
    expect(translatePlace("西二教学楼")).toBe("West 2 Teaching Building");
    expect(translatePlace("Demo Hall 101")).toBe("Demo Hall 101");
    expect(translatePlace(null)).toBeNull();
  });
});

describe("translateNote", () => {
  it("translates room-change notes", () => {
    expect(translateNote("管理学院C110（10月23日在B211）2026级PIEGL")).toBe("School of Management C110 (23 Oct in B211) 2026 PIEGL cohort");
    expect(translateNote("管理学院A202 2026级PIEGL")).toBe("School of Management A202 2026 PIEGL cohort");
    expect(translateNote("Room C1 (23 Oct in B2)")).toBe("Room C1 (23 Oct in B2)");
  });
});

describe("loadCourseNames", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("reads the owner's names file, or nothing when there is none", () => {
    dir = mkdtempSync(path.join(tmpdir(), "psa-names-"));
    expect(loadCourseNames(dir)).toEqual({});
    writeFileSync(path.join(dir, COURSE_NAMES_FILE), JSON.stringify({ 演示课程: "Demo Course" }));
    expect(loadCourseNames(dir)).toEqual({ 演示课程: "Demo Course" });
  });

  it("refuses a names file with the wrong shape", () => {
    dir = mkdtempSync(path.join(tmpdir(), "psa-names-"));
    writeFileSync(path.join(dir, COURSE_NAMES_FILE), JSON.stringify({ a: 1 }));
    expect(() => loadCourseNames(dir as string)).toThrow(ImportError);
  });
});
```

Add to `tests/import/run.test.ts`: import `writeFileSync` is already there; import `updateTask` is already there; add `COURSE_NAMES_FILE` from `@/import/translate`; then add inside `describe("importSnapshots", ...)`:

```ts
  it("uses English course names, translates rooms and semesters, and keeps renamed titles", () => {
    addSamples(dir);
    const db = memoryDb();
    importSnapshots(db, dir, NOW);
    const seminar = getCourseByExternalId(db, "yjsy:class:9000003001");
    if (!seminar) throw new Error("missing course");
    updateCourse(db, seminar.id, { title: "My seminar" }, NOW);

    writeFileSync(
      path.join(dir, COURSE_NAMES_FILE),
      JSON.stringify({ "Demo Strategy": "Strategy in English", "Demo Seminar": "Seminar in English" }),
    );
    importSnapshots(db, dir, NOW + 1000);

    expect(getCourseByExternalId(db, "tc:course:900001")?.title).toBe("Strategy in English");
    expect(getCourseByExternalId(db, "yjsy:class:9000003001")?.title).toBe("My seminar");
    expect(getCourseByExternalId(db, "tc:course:900002")?.semester).toBe("2026–2027 Autumn-Winter");
  });

  it("keeps a task title the owner changed when importing again", () => {
    addSamples(dir);
    const db = memoryDb();
    importSnapshots(db, dir, NOW);
    const task = getTaskByExternalId(db, "tc:activity:910010");
    if (!task) throw new Error("missing task");
    updateTask(db, task.id, { title: "Write characters for lessons 2 and 3", type: task.type, courseId: task.courseId, dueAt: task.dueAt }, NOW);
    importSnapshots(db, dir, NOW + 1000);
    expect(getTaskByExternalId(db, "tc:activity:910010")?.title).toBe("Write characters for lessons 2 and 3");
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/import/translate.test.ts tests/import/run.test.ts`
Expected: FAIL with "Failed to resolve import @/import/translate".

- [ ] **Step 3: Implement**

`src/import/translate.ts`:

```ts
// Small, fixed word lists for ZJU data. Unknown words are left as they are.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ImportError } from "@/import/errors";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SEASONS: [RegExp, string][] = [
  [/秋冬/g, " Autumn–Winter"],
  [/春夏/g, " Spring–Summer"],
  [/秋/g, " Autumn"],
  [/冬/g, " Winter"],
  [/春/g, " Spring"],
  [/夏/g, " Summer"],
  [/暑/g, " Summer term"],
  [/短/g, " Short term"],
];

const PLACES: [RegExp, string][] = [
  [/紫金港/g, " Zijingang "],
  [/玉泉/g, " Yuquan "],
  [/西溪/g, " Xixi "],
  [/华家池/g, " Huajiachi "],
  [/之江/g, " Zhijiang "],
  [/海宁/g, " Haining "],
  [/舟山/g, " Zhoushan "],
  [/管理学院/g, " School of Management "],
  [/教学楼/g, " Teaching Building "],
  [/东/g, " East "],
  [/西/g, " West "],
  [/南/g, " South "],
  [/北/g, " North "],
];

const NUMERALS: Record<string, string> = { 一: "1", 二: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8", 九: "9", 十: "10" };

const tidy = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();

export function translateSemester(value: string | null): string | null {
  if (!value) return value;
  let out = value;
  for (const [pattern, english] of SEASONS) out = out.replace(pattern, english);
  return tidy(out).replace(/^(\d{4})-(\d{4})/, "$1–$2");
}

export function translatePlace(value: string | null): string | null {
  if (!value) return value;
  let out = value;
  for (const [pattern, english] of PLACES) out = out.replace(pattern, english);
  out = out.replace(/[一二三四五六七八九十]/g, (n) => NUMERALS[n] ?? n);
  return tidy(out);
}

export function translateNote(value: string | null): string | null {
  if (!value) return value;
  const out = value
    .replace(/(\d{1,2})月(\d{1,2})日/g, (_, m: string, d: string) => `${Number(d)} ${MONTHS[Number(m) - 1] ?? m}`)
    .replace(/(\d{4})级([A-Za-z]*)/g, (_, year: string, group: string) => ` ${year}${group ? ` ${group}` : ""} cohort `)
    .replace(/[（(]/g, " (")
    .replace(/[）)]/g, ") ")
    .replace(/在/g, " in ");
  return translatePlace(out);
}

export const COURSE_NAMES_FILE = "course-names.json";

const namesSchema = z.record(z.string(), z.string());

export function loadCourseNames(dir: string): Record<string, string> {
  const file = path.join(dir, COURSE_NAMES_FILE);
  if (!existsSync(file)) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new ImportError(`${COURSE_NAMES_FILE} is not valid JSON.`);
  }
  const parsed = namesSchema.safeParse(raw);
  if (!parsed.success) throw new ImportError(`${COURSE_NAMES_FILE} must map each ZJU course title to an English title.`);
  return parsed.data;
}
```


`src/import/errors.ts` (moved out of `run.ts` so `translate.ts` and `run.ts` do not import each other):

```ts
export class ImportError extends Error {
  name = "ImportError";
}
```

In `src/import/run.ts`:
0. Delete the `ImportError` class and add `import { ImportError } from "@/import/errors";` plus `export { ImportError };` so existing imports from `@/import/run` keep working.
1. Add `import { loadCourseNames, translateNote, translatePlace, translateSemester } from "@/import/translate";`.
2. In `importSnapshots`, after the two `mapTronclass` / `mapYjsy` lines (still before the transaction), add `const names = loadCourseNames(dir);` and `const english = (title: string) => names[title] ?? title;`.
3. Give `ensureCourse` a fourth parameter `originalTitle: string`. In its update branch, before the `UPDATE`, add:

```ts
        if (existing.title === originalTitle && input.title !== originalTitle) {
          db.prepare("UPDATE courses SET title = ? WHERE id = ?").run(input.title, existing.id);
        }
```

4. Update the three `ensureCourse` callers:
   - TronClass: `ensureCourse(c.externalId, { title: english(c.title), code: c.code, instructor: c.instructor, semester: translateSemester(c.semester) }, c.classNo, c.title)`
   - `courseFor`: `ensureCourse(`yjsy:class:${classNo}`, { title: english(title), code: classNo, instructor: teacher, notes: translateNote(notes) }, classNo, title)`
5. In the meeting insert, use `room: translatePlace(m.room)`.
6. In the task update, drop the title: `UPDATE tasks SET due_at = ?, course_id = ?, updated_at = ? WHERE id = ?` with `.run(t.dueAt, courseId, now, existing.id)`.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/import`
Expected: PASS, including the existing "keeps the owner's edits" test.

- [ ] **Step 5: Docs**

In `README.md`, at the end of the "Your ZJU data" section, add:

```markdown
To show course names in English, put `course-names.json` in the same folder: a map from each ZJU course title to its English title, for example `{ "示例课程": "Example Course" }`. Rooms, semesters and room notes are translated automatically. You can also rename any course or task in the app; importing again never undoes that.
```

- [ ] **Step 6: Run all checks and build**

Run: `npm run check && npm run build`
Expected: all PASS, no build warnings.

- [ ] **Step 7: Commit**

```bash
git add src/import/errors.ts src/import/translate.ts src/import/run.ts tests/import/translate.test.ts tests/import/run.test.ts README.md
git commit -m "Show ZJU courses, rooms and semesters in English" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Check the app with the owner's real snapshots**

The owner's snapshots are in `~/PIEGL-data/snapshots/`. The app writes only to `~/PIEGL-data/study.db`.

First write `~/PIEGL-data/snapshots/course-names.json` (mode `0600`) with English titles for each course in the owner's snapshots. Prefer the English title printed on the course's own syllabus or files (visible in the snapshot's file names), else a faithful translation. Never copy this file into the repo.

Start the preview `study-agency`, then:
- Settings: both snapshot files are listed. Click **Import ZJU snapshots**. The message reads like "Added 7 courses and … tasks, … saved 7 class times. Skipped … past items …".
- Courses: 7 courses with English titles. Class times read like "Mon 8:50–12:25 · weeks 1–3, 5–8" and rooms like "Zijingang West 2-103". The two courses without a weekly slot show their translated room notes on their course pages.
- Today: "Due next" lists the nearest ZJU deadlines; "Prepare next" shows the next class with its room; the top task lists its reasons.
- Deadlines: overdue / this week / later groups look right; **Done**, **+1 day** and **Edit** work. Give one imported task an estimate and see the workload chart change.
- On one course, add a prep routine (12 hours, 45 minutes): prep tasks appear on that course and in Deadlines.
- Press `n` on Today: it opens Deadlines with the title field focused. Press `?`: the shortcut list opens.
- Click Import again: "Added 0 courses and 0 tasks…". The edits made above are still there.
- Mobile width (375px) and dark mode: no page-wide sideways scroll, text readable. Console: no errors.

Take a screenshot of Today for the milestone report.

- [ ] **Step 9: Milestone report**

Report to the owner: checks and results, the Today screenshot, what changed, files changed, the rulings made, and ask before starting the sync milestone.

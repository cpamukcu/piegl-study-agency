// Records how the last sync went, so the app and the schedule can tell whether a sync is due.
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DAY_MS } from "@/lib/time";

export const STATUS_FILE = "sync-status.json";
export const DEFAULT_EVERY_DAYS = 3;

export type SyncState = "ok" | "needs-login" | "error";

export type SyncStatus = {
  state: SyncState;
  lastAttemptAt: number;
  lastSuccessAt: number | null;
  message: string;
};

export function readStatus(dataDir: string): SyncStatus | null {
  const file = path.join(dataDir, STATUS_FILE);
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<SyncStatus>;
    if (typeof raw.lastAttemptAt !== "number" || !raw.state) return null;
    return {
      state: raw.state,
      lastAttemptAt: raw.lastAttemptAt,
      lastSuccessAt: typeof raw.lastSuccessAt === "number" ? raw.lastSuccessAt : null,
      message: raw.message ?? "",
    };
  } catch {
    return null;
  }
}

export function writeStatus(dataDir: string, status: SyncStatus): void {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const file = path.join(dataDir, STATUS_FILE);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(status, null, 2), { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, file);
}

export function everyDays(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_EVERY_DAYS;
}

// The schedule wakes up daily; a sync runs only when the last good one is old enough.
// A failed attempt does not reset the clock, so a broken login is retried at the next wake-up.
export function isDue(status: SyncStatus | null, now: number, days: number): boolean {
  if (!status || status.lastSuccessAt === null) return true;
  return now - status.lastSuccessAt >= days * DAY_MS - 60 * 60 * 1000;
}

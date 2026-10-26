// One full sync: fetch from ZJU, save dated snapshots, import them, record how it went.
import { execFile } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "@/db/connection";
import { describeImport, importSnapshots } from "@/import/run";
import { fetchAll } from "@/sync/browser";
import { NeedsLoginError } from "@/sync/errors";
import { everyDays, isDue, readStatus, writeStatus, type SyncStatus } from "@/sync/status";
import { shanghaiParts } from "@/lib/time";

const pad = (n: number) => String(n).padStart(2, "0");

export function snapshotDate(now: number): string {
  const p = shanghaiParts(now);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function writeJson(file: string, value: unknown): void {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(tmp, file);
}

function notify(message: string): void {
  if (process.platform !== "darwin") return;
  const script = `display notification ${JSON.stringify(message)} with title "PIEGL Study Agency"`;
  execFile("osascript", ["-e", script], () => {});
}

export type SyncOutcome = { state: "ok" | "needs-login" | "error" | "skipped"; message: string };

export async function runSync(dataDir: string, options: { force: boolean; headless?: boolean }, now = Date.now()): Promise<SyncOutcome> {
  const previous = readStatus(dataDir);
  if (!options.force && !isDue(previous, now, everyDays(process.env.SYNC_EVERY_DAYS))) {
    return { state: "skipped", message: "Last sync is recent enough. Use --force to sync anyway." };
  }

  const record = (state: SyncStatus["state"], message: string): SyncOutcome => {
    writeStatus(dataDir, {
      state,
      lastAttemptAt: now,
      lastSuccessAt: state === "ok" ? now : (previous?.lastSuccessAt ?? null),
      message,
    });
    return { state, message };
  };

  try {
    const { tronclass, yjsy } = await fetchAll({ dataDir, headless: options.headless ?? true }, now);
    const dir = path.join(dataDir, "snapshots");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const date = snapshotDate(now);
    writeJson(path.join(dir, `courses-zju-${date}.json`), tronclass);
    writeJson(path.join(dir, `timetable-yjsy-${date}.json`), yjsy);
    return record("ok", describeImport(importSnapshots(getDb(), dir, now)));
  } catch (error) {
    if (error instanceof NeedsLoginError) {
      const message = "ZJU login expired. Run `npm run sync:login`, then sync again.";
      notify(message);
      return record("needs-login", message);
    }
    const message = error instanceof Error ? error.message : String(error);
    notify(`Sync failed: ${message}`);
    return record("error", message);
  }
}

// One full sync: fetch from ZJU, save dated snapshots, import them, record how it went.
import { execFile } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "@/db/connection";
import { getCourseByExternalId } from "@/db/courses";
import { addMaterial, hasExternalMaterial, wasDeleted } from "@/db/materials";
import { describeImport, importSnapshots } from "@/import/run";
import { fetchAll } from "@/sync/browser";
import { NeedsLoginError } from "@/sync/errors";
import { describeDownloads, remoteFiles } from "@/sync/materials";
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

// Course files download unless SYNC_MATERIALS is set to 0, false or off.
export function downloadsEnabled(value: string | undefined): boolean {
  return !["0", "false", "off", "no"].includes((value ?? "").trim().toLowerCase());
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
    const db = getDb();
    let imported = "";
    const { files } = await fetchAll({ dataDir, headless: options.headless ?? true }, now, {
      afterSnapshots: ({ tronclass, yjsy }) => {
        const dir = path.join(dataDir, "snapshots");
        mkdirSync(dir, { recursive: true, mode: 0o700 });
        const date = snapshotDate(now);
        writeJson(path.join(dir, `courses-zju-${date}.json`), tronclass);
        writeJson(path.join(dir, `timetable-yjsy-${date}.json`), yjsy);
        imported = describeImport(importSnapshots(db, dir, now));
      },
      pickFiles: (snapshot) =>
        downloadsEnabled(process.env.SYNC_MATERIALS)
          ? remoteFiles(snapshot, now).filter((f) => !hasExternalMaterial(db, f.externalId) && !wasDeleted(db, f.externalId))
          : [],
      saveFile: async (file, bytes) => {
        const course = getCourseByExternalId(db, file.courseExternalId);
        if (!course) return;
        await addMaterial(db, dataDir, { courseId: course.id, fileName: file.name, bytes, source: "zju", externalId: file.externalId }, now);
      },
    });
    return record("ok", [imported, files ? describeDownloads(files) : ""].filter(Boolean).join(" "));
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

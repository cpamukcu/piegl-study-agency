// Picks which Courses@ZJU files to download and downloads them with read-only GETs.
// Download flow (as used by open-source TronClass clients): GET /api/uploads/reference/document/{reference_id}/url
// returns {"url": "..."}, a short-lived link to the file itself.
import type { TronclassSnapshot } from "@/import/schemas";
import { kindOf } from "@/extract";
import { MAX_MATERIAL_BYTES } from "@/db/materials";
import { NeedsLoginError, SyncError } from "@/sync/errors";
import type { GetJson } from "@/sync/tronclass";
import { DAY_MS } from "@/lib/time";

export type RemoteFile = {
  externalId: string;
  courseExternalId: string;
  referenceId: number;
  name: string;
  size: number | null;
  activity: string;
};

const ACTIVITY_TYPES = new Set(["material", "homework", "page", "lesson", "courseware"]);
const STALE_AFTER_MS = 14 * DAY_MS;

export function remoteFiles(snapshot: TronclassSnapshot, now: number): RemoteFile[] {
  const out: RemoteFile[] = [];
  const seen = new Set<string>();
  for (const course of snapshot.courses) {
    if (course.end_date && Date.parse(course.end_date) < now - STALE_AFTER_MS) continue;
    for (const activity of course.activities) {
      if (!ACTIVITY_TYPES.has(activity.type) || activity.published === false) continue;
      for (const upload of activity.uploads) {
        const externalId = `tc:upload:${upload.id}`;
        if (upload.reference_id === null || seen.has(externalId)) continue;
        if (kindOf(upload.name) === "other") continue; // PDF, PPTX and text only: the files the app can read.
        if (upload.size !== null && upload.size > MAX_MATERIAL_BYTES) continue;
        seen.add(externalId);
        out.push({
          externalId,
          courseExternalId: `tc:course:${course.id}`,
          referenceId: upload.reference_id,
          name: upload.name,
          size: upload.size,
          activity: activity.title,
        });
      }
    }
  }
  return out;
}

export type GetBytes = (url: string) => Promise<Uint8Array>;

export type DownloadReport = { downloaded: number; failed: string[]; left: number };

export async function downloadFiles(
  files: RemoteFile[],
  getJson: GetJson,
  getBytes: GetBytes,
  save: (file: RemoteFile, bytes: Uint8Array) => Promise<void>,
  limit: number,
): Promise<DownloadReport> {
  const report: DownloadReport = { downloaded: 0, failed: [], left: Math.max(0, files.length - limit) };
  for (const file of files.slice(0, limit)) {
    try {
      const answer = (await getJson(`/api/uploads/reference/document/${file.referenceId}/url?preview=false`)) as { url?: unknown };
      if (typeof answer?.url !== "string" || !/^https?:\/\//.test(answer.url)) throw new SyncError("no download link");
      const bytes = await getBytes(answer.url);
      if (bytes.byteLength > MAX_MATERIAL_BYTES) throw new SyncError("file over 50 MB");
      await save(file, bytes);
      report.downloaded += 1;
    } catch (error) {
      if (error instanceof NeedsLoginError) throw error;
      report.failed.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return report;
}

export function describeDownloads(report: DownloadReport): string {
  if (report.downloaded === 0 && report.failed.length === 0) return "";
  const parts = [`${report.downloaded} course file${report.downloaded === 1 ? "" : "s"} downloaded`];
  if (report.failed.length) parts.push(`${report.failed.length} failed (${report.failed.slice(0, 3).join("; ")})`);
  if (report.left) parts.push(`${report.left} more next time`);
  return `${parts.join(", ")}.`;
}

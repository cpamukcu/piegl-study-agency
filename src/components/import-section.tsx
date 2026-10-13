import path from "node:path";
import { connection } from "next/server";
import { Icon } from "@/components/icons";
import { ImportPanel } from "@/components/import-panel";
import { CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { lastImport, listSnapshotFiles } from "@/import/run";
import { requestTime } from "@/lib/clock";
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
      <div className="flex gap-4">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-periwinkle">
        <Icon name="import" />
      </span>
      <div className="min-w-0 flex-1">
      <h2 id="import-heading" className="text-lg">
        ZJU snapshots
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Saved copies of your ZJU courses, deadlines and timetable, kept in <span className="font-mono">{dir}</span>. Importing adds
        new items and picks up ZJU&rsquo;s changes, such as a moved due date. It never undoes your own edits.
      </p>
      {files.length ? (
        <ul className="mt-3 divide-y divide-line rounded-[14px] bg-tint font-mono text-[13px] text-ink ring-1 ring-line">
          {files.map((file) => (
            <li key={file} className="px-3 py-2">
              {file}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm">No snapshot files yet.</p>
      )}
      <p className="mt-3 text-sm text-ink-muted">
        {last ? `Last import: ${formatDue(last.importedAt, requestTime())} (${last.fileName})` : "Not imported yet."}
      </p>
      <ImportPanel files={files} />
      </div>
      </div>
    </section>
  );
}

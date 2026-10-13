import path from "node:path";
import { connection } from "next/server";
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
      <h2 id="import-heading" className="font-serif text-lg">
        ZJU snapshots
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        Saved copies of your ZJU courses, deadlines and timetable, kept in <span className="font-mono">{dir}</span>. Importing adds
        new items and picks up ZJU&rsquo;s changes, such as a moved due date. It never undoes your own edits.
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
        {last ? `Last import: ${formatDue(last.importedAt, requestTime())} (${last.fileName})` : "Not imported yet."}
      </p>
      <ImportPanel files={files} />
    </section>
  );
}

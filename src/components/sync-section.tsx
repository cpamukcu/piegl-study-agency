import { connection } from "next/server";
import { CARD } from "@/components/ui";
import { requestTime } from "@/lib/clock";
import { DataDirError, getDataDir } from "@/lib/data-dir";
import { formatDue } from "@/lib/time";
import { readStatus } from "@/sync/status";

export async function SyncSection() {
  await connection();
  let status = null;
  try {
    status = readStatus(getDataDir());
  } catch (error) {
    if (error instanceof DataDirError) return null; // The data folder card already explains the problem.
    throw error;
  }
  const now = requestTime();

  return (
    <section aria-labelledby="sync-heading" className={CARD}>
      <h2 id="sync-heading" className="font-serif text-lg">
        Automatic ZJU sync
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        A dedicated Chrome profile reads your ZJU courses, deadlines and timetable (read-only) every few days and imports them.
        Set it up on your Mac with <span className="font-mono">npm run sync:login</span> once, then{" "}
        <span className="font-mono">npm run sync:schedule</span>.
      </p>
      <p className="mt-3 text-sm">
        {status
          ? `Last attempt: ${formatDue(status.lastAttemptAt, now)} — ${status.state === "ok" ? "worked" : status.state === "needs-login" ? "needs you to log in again" : "failed"}.`
          : "No sync has run yet."}
      </p>
      {status?.lastSuccessAt ? <p className="mt-1 text-sm text-ink-muted">Last good sync: {formatDue(status.lastSuccessAt, now)}</p> : null}
      {status && status.state !== "ok" ? <p className="mt-1 text-sm">{status.message}</p> : null}
    </section>
  );
}

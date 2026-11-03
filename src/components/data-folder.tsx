import { connection } from "next/server";
import { Icon } from "@/components/icons";
import { CARD } from "@/components/ui";
import { DataDirError, getDataDir } from "@/lib/data-dir";

type DataDirStatus = { ok: true; path: string } | { ok: false; message: string };

function readDataDir(): DataDirStatus {
  try {
    return { ok: true, path: getDataDir() };
  } catch (error) {
    if (error instanceof DataDirError) return { ok: false, message: error.message };
    throw error;
  }
}

function DataFolderCard({ children }: { children: React.ReactNode }) {
  return (
    <section className={CARD}>
      <div className="flex gap-4">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lavender-50 text-lavender">
          <Icon name="folder" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg">Data folder</h2>
          <p className="mt-1 text-sm text-ink-muted">Your database, course files, and ZJU session are kept here, outside the code repository.</p>
          {children}
        </div>
      </div>
    </section>
  );
}

// Waits for a real request so DATA_DIR is read at request time, not baked in at build time.
export async function DataFolder() {
  await connection();
  const dataDir = readDataDir();

  return (
    <DataFolderCard>
      {dataDir.ok ? (
        <p className="mt-3 break-all rounded-[12px] bg-tint px-3 py-2 font-mono text-[13px] text-ink ring-1 ring-line">{dataDir.path}</p>
      ) : (
        <p role="alert" className="mt-3 text-sm text-warn">
          {dataDir.message} Set DATA_DIR in .env.local.
        </p>
      )}
    </DataFolderCard>
  );
}

export function DataFolderFallback() {
  return (
    <DataFolderCard>
      <p className="mt-3 text-sm text-ink-muted">Checking…</p>
    </DataFolderCard>
  );
}

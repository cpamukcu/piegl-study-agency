import { connection } from "next/server";
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
    <section className="rounded-lg border border-line bg-surface p-6">
      <h2 className="font-serif text-lg">Data folder</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Your database, course files, and ZJU session are kept here, outside the code repository.
      </p>
      {children}
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
        <p className="mt-3 font-mono text-sm">{dataDir.path}</p>
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

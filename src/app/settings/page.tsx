import { Suspense } from "react";
import { DataFolder, DataFolderFallback } from "@/components/data-folder";
import { ImportSection } from "@/components/import-section";
import { IntegrityNote } from "@/components/integrity-note";
import { PageHeader } from "@/components/page-header";
import { SyncSection } from "@/components/sync-section";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Where your data lives, and how the app works." />
      <div className="space-y-4">
        <Suspense fallback={<DataFolderFallback />}>
          <DataFolder />
        </Suspense>
        <Suspense fallback={null}>
          <ImportSection />
        </Suspense>
        <Suspense fallback={null}>
          <SyncSection />
        </Suspense>
        <IntegrityNote />
      </div>
    </>
  );
}

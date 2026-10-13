import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PrepareData } from "@/components/prepare-data";

export default function PreparePage() {
  return (
    <>
      <PageHeader
        title="Prepare Class"
        icon="prepare"
        description="Turn slides and readings into a Class Ready Brief before each session."
      />
      <Suspense fallback={<p className="text-ink-muted">Loading your next class…</p>}>
        <PrepareData />
      </Suspense>
    </>
  );
}

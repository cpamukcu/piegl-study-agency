import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PrepareData } from "@/components/prepare-data";

export default function PreparePage({ searchParams }: PageProps<"/prepare">) {
  return (
    <>
      <PageHeader
        title="Prepare Class"
        icon="prepare"
        description="Turn slides and readings into a Class Ready Brief before each session. You see exactly what is sent first."
      />
      <Suspense fallback={<p className="text-ink-muted">Loading your next class…</p>}>
        <PrepareData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

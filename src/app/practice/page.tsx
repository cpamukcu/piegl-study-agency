import { Suspense } from "react";
import { IntegrityNote } from "@/components/integrity-note";
import { PageHeader } from "@/components/page-header";
import { PracticeData } from "@/components/practice-data";

export default function PracticePage({ searchParams }: PageProps<"/practice">) {
  return (
    <>
      <PageHeader
        title="Practice"
        description="Professor Mode: answer one question at a time in your own words and get honest feedback against the slides."
      />
      <div className="space-y-6">
        <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
          <PracticeData searchParams={searchParams} />
        </Suspense>
        <IntegrityNote />
      </div>
    </>
  );
}

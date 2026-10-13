import { Suspense } from "react";
import { DeadlinesData } from "@/components/deadlines-data";
import { PageHeader } from "@/components/page-header";

export default function DeadlinesPage() {
  return (
    <>
      <PageHeader title="Deadlines" description="Upcoming and overdue work, and how heavy each week looks." />
      <Suspense fallback={<p className="text-ink-muted">Loading deadlines…</p>}>
        <DeadlinesData />
      </Suspense>
    </>
  );
}

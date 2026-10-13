import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { TodayData } from "@/components/today-data";

export default function TodayPage() {
  return (
    <>
      <PageHeader title="Today" description="What is due, what to prepare, and where to put your best hour." />
      <Suspense fallback={<p className="text-ink-muted">Loading today…</p>}>
        <TodayData />
      </Suspense>
    </>
  );
}

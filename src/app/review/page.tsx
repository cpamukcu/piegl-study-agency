import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ReviewData } from "@/components/review-data";

export default function ReviewPage({ searchParams }: PageProps<"/review">) {
  return (
    <>
      <PageHeader title="Weekly Review" description="Look back at the week and plan a realistic next one." />
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <ReviewData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

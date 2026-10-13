import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ReviewData } from "@/components/review-data";

export default function ReviewPage() {
  return (
    <>
      <PageHeader title="Weekly Review" icon="review" description="Look back at the week and plan a realistic next one." />
      <Suspense fallback={<p className="text-ink-muted">Loading your week…</p>}>
        <ReviewData />
      </Suspense>
    </>
  );
}

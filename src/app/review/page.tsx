import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function ReviewPage() {
  return (
    <>
      <PageHeader title="Weekly Review" description="Look back at the week and plan a realistic next one." />
      <EmptyState title="No weeks to review yet" art="chart">
        What you planned, finished, postponed, and found confusing will show here.
      </EmptyState>
    </>
  );
}

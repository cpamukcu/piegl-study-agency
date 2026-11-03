import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ResearchData } from "@/components/research-data";

export default function ResearchPage() {
  return (
    <>
      <PageHeader title="Research" description="Break a question into a plan, and keep sources you have checked yourself." />
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <ResearchData />
      </Suspense>
    </>
  );
}

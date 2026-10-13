import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function ResearchPage() {
  return (
    <>
      <PageHeader
        title="Research"
        description="Break a question into a plan, and keep sources you have checked yourself."
      />
      <EmptyState title="No research questions yet" art="search">
        Your research questions and verified sources will be kept here. Sources are only ever added by you.
      </EmptyState>
    </>
  );
}

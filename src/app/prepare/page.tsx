import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function PreparePage() {
  return (
    <>
      <PageHeader
        title="Prepare Class"
        description="Turn slides and readings into a Class Ready Brief before each session."
      />
      <EmptyState title="No class materials yet" art="books">
        Slides and readings for your next classes will show here, ready to study.
      </EmptyState>
    </>
  );
}

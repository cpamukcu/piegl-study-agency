import { EmptyState } from "@/components/empty-state";
import { IntegrityNote } from "@/components/integrity-note";
import { PageHeader } from "@/components/page-header";

export default function PracticePage() {
  return (
    <>
      <PageHeader
        title="Practice"
        description="Answer professor-style questions one at a time and get honest feedback."
      />
      <div className="space-y-4">
        <EmptyState title="Nothing to practise yet" art="talk">
          Questions from your class material will show here once you prepare a class.
        </EmptyState>
        <IntegrityNote />
      </div>
    </>
  );
}

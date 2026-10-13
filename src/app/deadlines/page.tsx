import { Suspense } from "react";
import { DeadlinesData } from "@/components/deadlines-data";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { BUTTON_PRIMARY } from "@/components/ui";

export default function DeadlinesPage({ searchParams }: PageProps<"/deadlines">) {
  return (
    <>
      <PageHeader title="Deadlines" icon="deadlines" description="Upcoming and overdue work, and how heavy each week looks.">
        <a href="#new-task" className={BUTTON_PRIMARY}>
          <Icon name="plus" className="size-4" />
          Add task
        </a>
      </PageHeader>
      <Suspense fallback={<p className="text-ink-muted">Loading deadlines…</p>}>
        <DeadlinesData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

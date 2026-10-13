import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { TasksData } from "@/components/tasks-data";
import { BUTTON_PRIMARY } from "@/components/ui";

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <>
      <PageHeader title="Tasks" icon="tasks" description="Everything on your list, split into today, what's next, and what's done.">
        <span className="hidden md:block">
          <a href="#new-task" className={BUTTON_PRIMARY}>
            <Icon name="plus" className="size-4" />
            Add task
          </a>
        </span>
      </PageHeader>
      <Suspense fallback={<p className="text-ink-muted">Loading tasks…</p>}>
        <TasksData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

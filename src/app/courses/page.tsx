import { Suspense } from "react";
import { CoursesData } from "@/components/courses-data";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { BUTTON_PRIMARY } from "@/components/ui";

export default function CoursesPage() {
  return (
    <>
      <PageHeader title="Courses" icon="courses" description="Your courses this semester, with times, instructors, and links.">
        <a href="#new-course" className={BUTTON_PRIMARY}>
          <Icon name="plus" className="size-4" />
          Add course
        </a>
      </PageHeader>
      <Suspense fallback={<p className="text-ink-muted">Loading courses…</p>}>
        <CoursesData />
      </Suspense>
    </>
  );
}

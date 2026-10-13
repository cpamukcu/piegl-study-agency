import { Suspense } from "react";
import { CoursesData } from "@/components/courses-data";
import { PageHeader } from "@/components/page-header";

export default function CoursesPage() {
  return (
    <>
      <PageHeader title="Courses" description="Your courses this semester, with times, instructors, and links." />
      <Suspense fallback={<p className="text-ink-muted">Loading courses…</p>}>
        <CoursesData />
      </Suspense>
    </>
  );
}

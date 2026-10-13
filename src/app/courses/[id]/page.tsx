import Link from "next/link";
import { Suspense } from "react";
import { CourseDetail } from "@/components/course-detail";

export default function CoursePage({ params }: PageProps<"/courses/[id]">) {
  return (
    <>
      <p className="mb-4 text-sm">
        <Link href="/courses" className="text-ink-muted hover:text-ink">
          ← All courses
        </Link>
      </p>
      <Suspense fallback={<p className="text-ink-muted">Loading course…</p>}>
        <CourseDetail params={params} />
      </Suspense>
    </>
  );
}

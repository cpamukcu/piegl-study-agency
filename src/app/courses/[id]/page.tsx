import Link from "next/link";
import { Suspense } from "react";
import { CourseDetail } from "@/components/course-detail";
import { Icon } from "@/components/icons";

export default function CoursePage({ params }: PageProps<"/courses/[id]">) {
  return (
    <>
      <p className="mb-5">
        <Link href="/courses" className="inline-flex items-center gap-1 rounded-full py-1 pr-3 text-sm font-semibold text-ink-muted hover:text-accent">
          <Icon name="chevron-left" className="size-4" />
          All courses
        </Link>
      </p>
      <Suspense fallback={<p className="text-ink-muted">Loading course…</p>}>
        <CourseDetail params={params} />
      </Suspense>
    </>
  );
}

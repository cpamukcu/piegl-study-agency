import Link from "next/link";
import { Suspense } from "react";
import { MaterialView } from "@/components/material-view";

export default function MaterialPage({ params }: PageProps<"/materials/[id]">) {
  return (
    <>
      <p className="mb-4 text-sm">
        <Link href="/courses" className="text-ink-muted hover:text-ink">
          ← Courses
        </Link>
      </p>
      <Suspense fallback={<p className="text-ink-muted">Loading file…</p>}>
        <MaterialView params={params} />
      </Suspense>
    </>
  );
}

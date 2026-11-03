import Link from "next/link";
import { Suspense } from "react";
import { ResearchView } from "@/components/research-view";

export default function ResearchProjectPage({ params }: PageProps<"/research/[id]">) {
  return (
    <>
      <p className="mb-4 text-sm">
        <Link href="/research" className="text-ink-muted hover:text-ink">
          ← Research
        </Link>
      </p>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <ResearchView params={params} />
      </Suspense>
    </>
  );
}

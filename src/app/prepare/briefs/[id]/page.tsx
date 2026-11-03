import Link from "next/link";
import { Suspense } from "react";
import { BriefView } from "@/components/brief-view";

export default function BriefPage({ params }: PageProps<"/prepare/briefs/[id]">) {
  return (
    <>
      <p className="mb-4 text-sm">
        <Link href="/prepare" className="text-ink-muted hover:text-ink">
          ← Prepare Class
        </Link>
      </p>
      <Suspense fallback={<p className="text-ink-muted">Loading brief…</p>}>
        <BriefView params={params} />
      </Suspense>
    </>
  );
}

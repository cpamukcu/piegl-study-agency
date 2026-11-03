import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { TimetableData } from "@/components/timetable-data";

export default function TimetablePage({ searchParams }: PageProps<"/timetable">) {
  return (
    <>
      <PageHeader title="Timetable" icon="timetable" description="Your classes and deadlines, day by day." />
      <Suspense fallback={<p className="text-ink-muted">Loading timetable…</p>}>
        <TimetableData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

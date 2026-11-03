import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DetailHeader } from "@/components/detail-header";
import { describeMaterial } from "@/components/material-list";
import { BUTTON_SECONDARY, CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { getCourse } from "@/db/courses";
import { getMaterial, listPages } from "@/db/materials";

export async function MaterialView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const db = getDb();
  const material = getMaterial(db, id);
  if (!material) notFound();
  const course = getCourse(db, material.courseId);
  const pages = listPages(db, id);
  const unit = material.kind === "pptx" ? "Slide" : material.kind === "text" ? "Part" : "Page";

  return (
    <div className="space-y-6">
      <DetailHeader
        title={material.title}
        icon="book"
        color={course?.color}
        eyebrow={
          course ? (
            <Link href={`/courses/${course.id}#materials-heading`} className="hover:text-accent">
              {course.title}
            </Link>
          ) : null
        }
      >
        <p className="text-ink-muted">
          {material.fileName} · {describeMaterial(material)}
        </p>
        <div className="flex flex-wrap gap-2">
          {material.kind === "pdf" && (
            <a href={`/materials/${material.id}/file`} target="_blank" rel="noreferrer" className={BUTTON_SECONDARY}>
              Open original
            </a>
          )}
          <a href={`/materials/${material.id}/file?download`} className={BUTTON_SECONDARY}>
            Download
          </a>
        </div>
        {material.extractionError && <p className="text-warn">{material.extractionError}</p>}
      </DetailHeader>

      {pages.length === 0 ? (
        <section className={CARD}>
          <p className="text-sm text-ink-muted">
            {material.extraction === "no-text"
              ? "This file has no text layer, which usually means scanned slides. OCR is not supported yet; open the original instead."
              : "No text could be read from this file. Open or download the original."}
          </p>
        </section>
      ) : (
        <ol className="space-y-4">
          {pages.map((p) => (
            <li key={p.page} id={`p-${p.page}`} className={`${CARD} scroll-mt-6`}>
              <h2 className="flex items-baseline justify-between text-[13px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                <span>
                  {unit} {p.page}
                </span>
                {material.kind === "pdf" && (
                  <a href={`/materials/${material.id}/file#page=${p.page}`} target="_blank" rel="noreferrer" className="font-semibold normal-case tracking-normal text-accent hover:underline">
                    View page
                  </a>
                )}
              </h2>
              {p.text ? (
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink">{p.text}</p>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">No text on this {unit.toLowerCase()}.</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

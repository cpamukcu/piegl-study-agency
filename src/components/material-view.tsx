import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CourseDot } from "@/components/course-dot";
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
      <header>
        <h1 className="font-serif text-3xl tracking-tight">{material.title}</h1>
        {course && (
          <p className="mt-2 flex items-center gap-2 text-ink-muted">
            <CourseDot color={course.color} />
            <Link href={`/courses/${course.id}`} className="hover:text-ink">
              {course.title}
            </Link>
          </p>
        )}
        <p className="mt-1 text-sm text-ink-muted">
          {material.fileName} · {describeMaterial(material)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {material.kind === "pdf" && (
            <a href={`/materials/${material.id}/file`} target="_blank" rel="noreferrer" className={BUTTON_SECONDARY}>
              Open original
            </a>
          )}
          <a href={`/materials/${material.id}/file?download`} className={BUTTON_SECONDARY}>
            Download
          </a>
        </div>
        {material.extractionError && <p className="mt-2 text-sm text-warn">{material.extractionError}</p>}
      </header>

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
              <h2 className="flex items-baseline justify-between text-sm font-semibold">
                <span>
                  {unit} {p.page}
                </span>
                {material.kind === "pdf" && (
                  <a href={`/materials/${material.id}/file#page=${p.page}`} target="_blank" rel="noreferrer" className="font-normal text-ink-muted hover:text-ink">
                    View page
                  </a>
                )}
              </h2>
              {p.text ? (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{p.text}</p>
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

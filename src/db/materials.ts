// Server-only: course files. The file itself lives under DATA_DIR/materials; its text lives in material_pages.
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { all, one, transaction, type Db } from "@/db/connection";
import { extract, kindOf, type MaterialKind } from "@/extract";

export const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;

export type ExtractionStatus = "ok" | "no-text" | "failed" | "unsupported";

export type Material = {
  id: string;
  courseId: string;
  title: string;
  fileName: string;
  kind: MaterialKind;
  relPath: string;
  sha256: string;
  size: number;
  pageCount: number | null;
  extraction: ExtractionStatus;
  extractionError: string | null;
  source: "manual" | "zju";
  externalId: string | null;
  createdAt: number;
};

export type MaterialPage = { materialId: string; page: number; text: string };

type MaterialRow = {
  id: string;
  course_id: string;
  title: string;
  file_name: string;
  kind: MaterialKind;
  rel_path: string;
  sha256: string;
  size: number;
  page_count: number | null;
  extraction: ExtractionStatus;
  extraction_error: string | null;
  source: "manual" | "zju";
  external_id: string | null;
  created_at: number;
};

const toMaterial = (r: MaterialRow): Material => ({
  id: r.id,
  courseId: r.course_id,
  title: r.title,
  fileName: r.file_name,
  kind: r.kind,
  relPath: r.rel_path,
  sha256: r.sha256,
  size: r.size,
  pageCount: r.page_count,
  extraction: r.extraction,
  extractionError: r.extraction_error,
  source: r.source,
  externalId: r.external_id,
  createdAt: r.created_at,
});

export function listMaterials(db: Db, courseId?: string): Material[] {
  const rows = courseId
    ? all<MaterialRow>(db, "SELECT * FROM materials WHERE course_id = ? ORDER BY created_at DESC, title", courseId)
    : all<MaterialRow>(db, "SELECT * FROM materials ORDER BY created_at DESC, title");
  return rows.map(toMaterial);
}

export function getMaterial(db: Db, id: string): Material | null {
  const row = one<MaterialRow>(db, "SELECT * FROM materials WHERE id = ?", id);
  return row ? toMaterial(row) : null;
}

export function hasExternalMaterial(db: Db, externalId: string): boolean {
  return one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM materials WHERE external_id = ?", externalId)!.n > 0;
}

export function listPages(db: Db, materialId: string): MaterialPage[] {
  return all<{ material_id: string; page: number; text: string }>(
    db,
    "SELECT * FROM material_pages WHERE material_id = ? ORDER BY page",
    materialId,
  ).map((r) => ({ materialId: r.material_id, page: r.page, text: r.text }));
}

// Keeps Chinese and other letters; removes path separators and control characters.
export function safeFileName(name: string): string {
  const base = path.basename(name.replace(/\\/g, "/")).normalize("NFC");
  const cleaned = base.replace(/[\u0000-\u001f\u007f/:*?"<>|]/g, "_").replace(/^\.+/, "").trim();
  if (!cleaned) return "file";
  if (cleaned.length <= 120) return cleaned;
  const ext = path.extname(cleaned).slice(0, 10);
  return cleaned.slice(0, 120 - ext.length) + ext;
}

export function materialFile(dataDir: string, material: Pick<Material, "relPath">): string {
  const root = path.join(dataDir, "materials");
  const file = path.resolve(root, material.relPath);
  if (!file.startsWith(root + path.sep)) throw new Error("Material path escapes the materials folder.");
  return file;
}

export type AddMaterialInput = {
  courseId: string;
  fileName: string;
  bytes: Uint8Array;
  title?: string | null;
  source?: "manual" | "zju";
  externalId?: string | null;
};

export type AddMaterialResult = { material: Material; duplicate: boolean };

export async function addMaterial(db: Db, dataDir: string, input: AddMaterialInput, now = Date.now()): Promise<AddMaterialResult> {
  if (input.bytes.byteLength > MAX_MATERIAL_BYTES) throw new Error("Files over 50 MB are not supported.");
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const existing = one<MaterialRow>(db, "SELECT * FROM materials WHERE course_id = ? AND sha256 = ?", input.courseId, sha256);
  if (existing) {
    // Same file again (for example uploaded by hand and later found on ZJU): remember the ZJU id, keep one copy.
    if (input.externalId && !existing.external_id) {
      db.prepare("UPDATE materials SET external_id = ? WHERE id = ?").run(input.externalId, existing.id);
    }
    return { material: getMaterial(db, existing.id) as Material, duplicate: true };
  }

  const fileName = safeFileName(input.fileName);
  const kind = kindOf(fileName);
  const relPath = path.join(input.courseId, `${sha256.slice(0, 12)}-${fileName}`);
  const file = materialFile(dataDir, { relPath });
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, input.bytes, { mode: 0o600 });
  renameSync(tmp, file);

  const result = await extract(kind, input.bytes);
  const id = randomUUID();
  const title = input.title?.trim() || fileName.replace(/\.[^.]+$/, "");
  try {
    transaction(db, () => {
      db.prepare(
        `INSERT INTO materials (id, course_id, title, file_name, kind, rel_path, sha256, size, page_count, extraction, extraction_error, source, external_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.courseId,
        title,
        fileName,
        kind,
        relPath,
        sha256,
        input.bytes.byteLength,
        result.status === "ok" ? result.pages.length : result.status === "no-text" ? result.pageCount : null,
        result.status,
        result.status === "failed" ? result.error.slice(0, 500) : null,
        input.source ?? "manual",
        input.externalId ?? null,
        now,
      );
      if (result.status === "ok") {
        const insert = db.prepare("INSERT INTO material_pages (material_id, page, text) VALUES (?, ?, ?)");
        result.pages.forEach((text, i) => insert.run(id, i + 1, text));
      }
    });
  } catch (error) {
    rmSync(file, { force: true });
    throw error;
  }
  return { material: getMaterial(db, id) as Material, duplicate: false };
}

export function renameMaterial(db: Db, id: string, title: string): void {
  db.prepare("UPDATE materials SET title = ? WHERE id = ?").run(title, id);
}

// Deletes the record and the file. A ZJU file deleted here would come back on the next sync,
// so its id is remembered in a tombstone row instead.
export function deleteMaterial(db: Db, dataDir: string, id: string): void {
  const material = getMaterial(db, id);
  if (!material) return;
  db.prepare("DELETE FROM materials WHERE id = ?").run(id);
  if (material.externalId) {
    db.prepare("INSERT OR IGNORE INTO deleted_external (external_id, deleted_at) VALUES (?, ?)").run(material.externalId, Date.now());
  }
  rmSync(materialFile(dataDir, material), { force: true });
}

export function wasDeleted(db: Db, externalId: string): boolean {
  return one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM deleted_external WHERE external_id = ?", externalId)!.n > 0;
}

export type PageRef = { materialId: string; page: number };

// Every page of the chosen materials, in order: the text the AI may cite.
export function pagesFor(db: Db, materialIds: string[]): (MaterialPage & { title: string })[] {
  const out: (MaterialPage & { title: string })[] = [];
  for (const id of materialIds) {
    const material = getMaterial(db, id);
    if (!material) continue;
    for (const p of listPages(db, id)) out.push({ ...p, title: material.title });
  }
  return out;
}

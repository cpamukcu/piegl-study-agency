import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCourse, deleteCourse } from "@/db/courses";
import { addMaterial, deleteMaterial, hasExternalMaterial, listMaterials, listPages, materialFile, safeFileName, wasDeleted } from "@/db/materials";
import type { Db } from "@/db/connection";
import { makePdf, makePptx } from "../helpers/files";
import { memoryDb } from "../helpers/db";

let dir: string;
let db: Db;
let courseId: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-materials-"));
  db = memoryDb();
  courseId = createCourse(db, { title: "Strategy" }).id;
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("materials", () => {
  it("stores the file under DATA_DIR/materials, privately, with its pages", async () => {
    const { material, duplicate } = await addMaterial(db, dir, { courseId, fileName: "Week 1.pdf", bytes: makePdf([["One"], ["Two"]]) });
    expect(duplicate).toBe(false);
    expect(material).toMatchObject({ title: "Week 1", kind: "pdf", pageCount: 2, extraction: "ok", source: "manual" });
    const file = materialFile(dir, material);
    expect(file.startsWith(path.join(dir, "materials", courseId))).toBe(true);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(readFileSync(file).subarray(0, 5).toString()).toBe("%PDF-");
    expect(listPages(db, material.id).map((p) => p.text)).toEqual(["One", "Two"]);
  });

  it("keeps one copy of the same file and learns its ZJU id", async () => {
    const bytes = makePptx([{ lines: ["Hello"] }]);
    const first = await addMaterial(db, dir, { courseId, fileName: "deck.pptx", bytes });
    const again = await addMaterial(db, dir, { courseId, fileName: "copy.pptx", bytes, source: "zju", externalId: "tc:upload:7" });
    expect(again).toMatchObject({ duplicate: true, material: { id: first.material.id, externalId: "tc:upload:7" } });
    expect(listMaterials(db, courseId)).toHaveLength(1);
    expect(hasExternalMaterial(db, "tc:upload:7")).toBe(true);
  });

  it("keeps unreadable files for download, marked unsupported", async () => {
    const { material } = await addMaterial(db, dir, { courseId, fileName: "old.ppt", bytes: new Uint8Array([1, 2, 3]) });
    expect(material).toMatchObject({ kind: "other", extraction: "unsupported", pageCount: null });
  });

  it("deletes the file, and remembers a deleted ZJU file so sync skips it", async () => {
    const { material } = await addMaterial(db, dir, { courseId, fileName: "a.pdf", bytes: makePdf([["x"]]), source: "zju", externalId: "tc:upload:9" });
    deleteMaterial(db, dir, material.id);
    expect(existsSync(materialFile(dir, material))).toBe(false);
    expect(listMaterials(db)).toEqual([]);
    expect(wasDeleted(db, "tc:upload:9")).toBe(true);
  });

  it("goes with its course", async () => {
    await addMaterial(db, dir, { courseId, fileName: "a.pdf", bytes: makePdf([["x"]]) });
    deleteCourse(db, courseId);
    expect(listMaterials(db)).toEqual([]);
  });

  it("makes file names safe without losing Chinese", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\Users\\me\\第三讲 创新.pdf")).toBe("第三讲 创新.pdf");
    expect(safeFileName("a:b?.pdf")).toBe("a_b_.pdf");
    expect(safeFileName("...")).toBe("file");
    expect(safeFileName(`${"x".repeat(200)}.pptx`)).toHaveLength(120);
    expect(() => materialFile(dir, { relPath: "../escape.pdf" })).toThrow();
  });
});

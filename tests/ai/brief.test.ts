import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiError } from "@/ai";
import { MAX_MATERIAL_CHARS, buildBriefPreview, briefSystem, generateBrief, resolveRefs } from "@/ai/brief";
import type { Db } from "@/db/connection";
import { createCourse, getCourse, setCourseAi, type Course } from "@/db/courses";
import { addMaterial, type Material } from "@/db/materials";
import { listConcepts, listFlashcards, listQuestions, setConceptStatus } from "@/db/study";
import { FakeProvider } from "../helpers/fake-ai";
import { makePdf, makePptx } from "../helpers/files";
import { memoryDb } from "../helpers/db";

let dir: string;
let db: Db;
let course: Course;
let pdf: Material;
let deck: Material;

const answer = {
  overview: "Lean start-up basics.",
  key_points: [
    { point: "Test assumptions early", refs: ["1:1"] },
    { point: "Invented point", refs: ["9:9"] },
    { point: "Pivot when evidence says so", refs: ['ref="2:2"', "1:2"] },
  ],
  concepts: [
    { term: "MVP", definition: "Smallest thing that tests a hypothesis.", refs: ["1:2"] },
    { term: "Ghost", definition: "Not in the slides.", refs: [] },
  ],
  ask_in_class: [{ question: "When is an MVP too small?", refs: ["1:2"] }],
  flashcards: [{ front: "MVP?", back: "Minimum viable product", refs: ["1:2"] }],
  practice_questions: [
    { question: "Explain the build-measure-learn loop.", kind: "explain", refs: ["2:1"] },
    { question: "Made up", kind: "recall", refs: ["3:1"] },
  ],
};

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-brief-"));
  db = memoryDb();
  course = createCourse(db, { title: "Entrepreneurship", code: "PIEGL101", instructor: "Dr. Demo" });
  pdf = (await addMaterial(db, dir, { courseId: course.id, fileName: "Week 3.pdf", bytes: makePdf([["Lean start-up"], ["MVP and testing"]]) })).material;
  deck = (await addMaterial(db, dir, { courseId: course.id, fileName: "Pivot.pptx", bytes: makePptx([{ lines: ["Build Measure Learn"] }, { lines: ["Pivot or persevere"] }]) })).material;
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("what is sent", () => {
  it("numbers pages per file and includes only course facts and page text", () => {
    const preview = buildBriefPreview(db, course, [pdf.id, deck.id], null);
    expect(preview.pages.map((p) => p.ref)).toEqual(["1:1", "1:2", "2:1", "2:2"]);
    expect(preview.prompt).toContain('<page ref="2:1" file="Pivot">');
    expect(preview.prompt).toContain("Course: Entrepreneurship (PIEGL101), taught by Dr. Demo");
    expect(preview.prompt).not.toContain(dir);
    expect(preview.tooLarge).toBe(false);
    expect(briefSystem()).toContain("Never make up a ref");
  });

  it("maps refs back to real pages and drops unknown ones", () => {
    const pages = buildBriefPreview(db, course, [pdf.id, deck.id], null).pages;
    expect(resolveRefs(["1:2", " 2:1 ", "1:2", "7:1", "ref=2:2"], pages)).toEqual([
      { materialId: pdf.id, page: 2 },
      { materialId: deck.id, page: 1 },
      { materialId: deck.id, page: 2 },
    ]);
  });
});

describe("generateBrief", () => {
  it("saves a brief whose every item points to a real page, and counts what was left out", async () => {
    const fake = new FakeProvider({ brief: answer });
    const brief = await generateBrief(db, fake, course, [pdf.id, deck.id], null);
    expect(brief.model).toBe("fake-brief");
    expect(brief.sections.keyPoints.map((k) => k.text)).toEqual(["Test assumptions early", "Pivot when evidence says so"]);
    expect(brief.sections.keyPoints[1].refs).toEqual([
      { materialId: deck.id, page: 2 },
      { materialId: pdf.id, page: 2 },
    ]);
    expect(brief.sections.removed).toBe(3);
    expect(listConcepts(db, { briefId: brief.id }).map((c) => [c.term, c.status])).toEqual([["MVP", "review"]]);
    expect(listFlashcards(db, brief.id)).toHaveLength(1);
    expect(listQuestions(db, { briefId: brief.id }).map((q) => q.kind)).toEqual(["explain"]);
  });

  it("lets the owner mark a concept confusing", async () => {
    const brief = await generateBrief(db, new FakeProvider({ brief: answer }), course, [pdf.id], null);
    const [concept] = listConcepts(db, { briefId: brief.id });
    setConceptStatus(db, concept.id, "confusing");
    expect(listConcepts(db, { status: "confusing" }).map((c) => c.term)).toEqual(["MVP"]);
  });

  it("sends nothing when the course has AI turned off, or AI is off", async () => {
    const fake = new FakeProvider({ brief: answer });
    setCourseAi(db, course.id, false);
    const off = getCourse(db, course.id) as Course;
    await expect(generateBrief(db, fake, off, [pdf.id], null)).rejects.toThrow("AI is turned off for Entrepreneurship. Nothing was sent.");
    await expect(generateBrief(db, null, course, [pdf.id], null)).rejects.toBeInstanceOf(AiError);
    expect(fake.requests).toEqual([]);
  });

  it("refuses files from another course, and too much text, without sending", async () => {
    const fake = new FakeProvider({ brief: answer });
    const other = createCourse(db, { title: "Other" });
    await expect(generateBrief(db, fake, other, [pdf.id], null)).rejects.toThrow("Choose at least one file");
    const big = (await addMaterial(db, dir, { courseId: course.id, fileName: "big.txt", bytes: new TextEncoder().encode("x".repeat(MAX_MATERIAL_CHARS + 1)) })).material;
    await expect(generateBrief(db, fake, course, [big.id], null)).rejects.toThrow("Choose fewer files");
    expect(fake.requests).toEqual([]);
  });
});

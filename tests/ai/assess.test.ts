import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assessAnswer, assessSystem, contextPages } from "@/ai/assess";
import { generateBrief } from "@/ai/brief";
import type { Db } from "@/db/connection";
import { createCourse, getCourse, setCourseAi, type Course } from "@/db/courses";
import { addMaterial, type Material } from "@/db/materials";
import { addQuestion, listAttempts, listQuestions, type PracticeQuestion } from "@/db/study";
import { FakeProvider } from "../helpers/fake-ai";
import { makePdf } from "../helpers/files";
import { memoryDb } from "../helpers/db";

let dir: string;
let db: Db;
let course: Course;
let pdf: Material;
let question: PracticeQuestion;

const ANSWER = "An MVP tests the riskiest assumption with the least effort, then you learn from real users.";

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-assess-"));
  db = memoryDb();
  course = createCourse(db, { title: "Entrepreneurship" });
  pdf = (await addMaterial(db, dir, { courseId: course.id, fileName: "w.pdf", bytes: makePdf([["One"], ["Two"], ["Three"], ["Four"], ["Five"]]) })).material;
  const brief = await generateBrief(
    db,
    new FakeProvider({
      brief: {
        overview: "x",
        key_points: [],
        concepts: [],
        ask_in_class: [],
        flashcards: [],
        practice_questions: [{ question: "What is an MVP for?", kind: "explain", refs: ["1:3"] }],
      },
    }),
    course,
    [pdf.id],
    null,
  );
  [question] = listQuestions(db, { briefId: brief.id });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

const assessment = {
  accuracy: 7,
  clarity: 0,
  evidence: 3,
  strengths: ["Clear core idea"],
  missing: ["No example"],
  outline: [
    { point: "MVP tests the riskiest assumption", label: "fact", refs: ["1:3"] },
    { point: "Claimed fact with no page", label: "fact", refs: ["1:1"] },
    { point: "Works best for software", label: "interpretation", refs: [] },
  ],
  follow_up: "Give an example from class.",
};

describe("Professor Mode", () => {
  it("sends the cited page with its neighbours", () => {
    expect(contextPages(db, question).map((p) => [p.ref, p.text])).toEqual([
      ["1:2", "Two"],
      ["1:3", "Three"],
      ["1:4", "Four"],
    ]);
    expect(assessSystem()).toContain("Never write a model answer or a script");
  });

  it("stores a rubric assessment, with scores kept to 1–5 and unsupported facts relabelled", async () => {
    const fake = new FakeProvider({ assess: assessment });
    const attempt = await assessAnswer(db, fake, course, question, `  ${ANSWER}  `);
    expect(fake.requests[0].prompt).toContain(`<answer>\n${ANSWER}\n</answer>`);
    expect(attempt.assessment).toMatchObject({ accuracy: 5, clarity: 1, evidence: 3, followUp: "Give an example from class." });
    expect(attempt.assessment.outline.map((o) => o.label)).toEqual(["fact", "interpretation", "interpretation"]);
    expect(attempt.assessment.outline[0].refs).toEqual([{ materialId: pdf.id, page: 3 }]);
    expect(listAttempts(db, { questionId: question.id })).toHaveLength(1);
  });

  it("assesses the owner's own question without material, as interpretation", async () => {
    const own = addQuestion(db, { courseId: course.id, question: "Why do start-ups fail?", kind: "critique" });
    const fake = new FakeProvider({ assess: assessment });
    const attempt = await assessAnswer(db, fake, course, own, ANSWER);
    expect(fake.requests[0].prompt).toContain("No course material is attached");
    expect(attempt.assessment.outline.every((o) => o.label === "interpretation")).toBe(true);
  });

  it("needs a real answer, and respects the course's AI switch", async () => {
    const fake = new FakeProvider({ assess: assessment });
    await expect(assessAnswer(db, fake, course, question, "too short")).rejects.toThrow("Write a real answer first");
    setCourseAi(db, course.id, false);
    await expect(assessAnswer(db, fake, getCourse(db, course.id) as Course, question, ANSWER)).rejects.toThrow("Nothing was sent");
    expect(fake.requests).toEqual([]);
  });
});

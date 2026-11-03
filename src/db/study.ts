// Server-only: Class Ready Briefs and what they produce (concepts, flashcards, practice questions, attempts).
import { randomUUID } from "node:crypto";
import { all, one, transaction, type Db } from "@/db/connection";
import type { PageRef } from "@/db/materials";

export const CONCEPT_STATUSES = ["understand", "review", "confusing"] as const;
export type ConceptStatus = (typeof CONCEPT_STATUSES)[number];
export const QUESTION_KINDS = ["recall", "explain", "apply", "critique"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export type Cited = { text: string; refs: PageRef[] };

export type BriefSections = {
  overview: string;
  keyPoints: Cited[];
  askInClass: Cited[];
  // Items the model returned without a real page reference; they were left out.
  removed: number;
};

export type Brief = {
  id: string;
  courseId: string;
  title: string;
  classAt: number | null;
  materialIds: string[];
  sections: BriefSections;
  model: string;
  createdAt: number;
};

export type Concept = {
  id: string;
  courseId: string;
  briefId: string | null;
  term: string;
  definition: string;
  status: ConceptStatus;
  refs: PageRef[];
  updatedAt: number;
};

export type Flashcard = { id: string; courseId: string; briefId: string | null; front: string; back: string; refs: PageRef[] };

export type PracticeQuestion = {
  id: string;
  courseId: string;
  briefId: string | null;
  question: string;
  kind: QuestionKind;
  refs: PageRef[];
  createdAt: number;
};

export type OutlinePoint = { point: string; label: "fact" | "interpretation"; refs: PageRef[] };

// Scores are 1–5. The outline is short points to build an answer from, never a script.
export type Assessment = {
  accuracy: number;
  clarity: number;
  evidence: number;
  strengths: string[];
  missing: string[];
  outline: OutlinePoint[];
  followUp: string;
};

export type Attempt = { id: string; questionId: string; answer: string; assessment: Assessment; model: string; createdAt: number };

type BriefRow = { id: string; course_id: string; title: string; class_at: number | null; material_ids_json: string; sections_json: string; model: string; created_at: number };

const toBrief = (r: BriefRow): Brief => ({
  id: r.id,
  courseId: r.course_id,
  title: r.title,
  classAt: r.class_at,
  materialIds: JSON.parse(r.material_ids_json) as string[],
  sections: JSON.parse(r.sections_json) as BriefSections,
  model: r.model,
  createdAt: r.created_at,
});

export type NewBrief = {
  courseId: string;
  title: string;
  classAt: number | null;
  materialIds: string[];
  model: string;
  sections: BriefSections;
  concepts: { term: string; definition: string; refs: PageRef[] }[];
  flashcards: { front: string; back: string; refs: PageRef[] }[];
  questions: { question: string; kind: QuestionKind; refs: PageRef[] }[];
};

export function createBrief(db: Db, input: NewBrief, now = Date.now()): Brief {
  const id = randomUUID();
  transaction(db, () => {
    db.prepare(
      "INSERT INTO briefs (id, course_id, title, class_at, material_ids_json, sections_json, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(id, input.courseId, input.title, input.classAt, JSON.stringify(input.materialIds), JSON.stringify(input.sections), input.model, now);
    const concept = db.prepare(
      "INSERT INTO concepts (id, course_id, brief_id, term, definition, refs_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const c of input.concepts) concept.run(randomUUID(), input.courseId, id, c.term, c.definition, JSON.stringify(c.refs), now, now);
    const card = db.prepare("INSERT INTO flashcards (id, course_id, brief_id, front, back, refs_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const f of input.flashcards) card.run(randomUUID(), input.courseId, id, f.front, f.back, JSON.stringify(f.refs), now);
    const question = db.prepare(
      "INSERT INTO practice_questions (id, course_id, brief_id, question, kind, refs_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const q of input.questions) question.run(randomUUID(), input.courseId, id, q.question, q.kind, JSON.stringify(q.refs), now);
  });
  return getBrief(db, id) as Brief;
}

export function getBrief(db: Db, id: string): Brief | null {
  const row = one<BriefRow>(db, "SELECT * FROM briefs WHERE id = ?", id);
  return row ? toBrief(row) : null;
}

export function listBriefs(db: Db, courseId?: string): Brief[] {
  const rows = courseId
    ? all<BriefRow>(db, "SELECT * FROM briefs WHERE course_id = ? ORDER BY created_at DESC", courseId)
    : all<BriefRow>(db, "SELECT * FROM briefs ORDER BY created_at DESC");
  return rows.map(toBrief);
}

// Concepts, cards and questions stay (without their brief) so marks and practice history survive.
export function deleteBrief(db: Db, id: string): void {
  db.prepare("DELETE FROM briefs WHERE id = ?").run(id);
}

type ConceptRow = { id: string; course_id: string; brief_id: string | null; term: string; definition: string; status: ConceptStatus; refs_json: string; updated_at: number };

const toConcept = (r: ConceptRow): Concept => ({
  id: r.id,
  courseId: r.course_id,
  briefId: r.brief_id,
  term: r.term,
  definition: r.definition,
  status: r.status,
  refs: JSON.parse(r.refs_json) as PageRef[],
  updatedAt: r.updated_at,
});

export function listConcepts(db: Db, filter: { briefId?: string; status?: ConceptStatus } = {}): Concept[] {
  const where: string[] = [];
  const params: string[] = [];
  if (filter.briefId) {
    where.push("brief_id = ?");
    params.push(filter.briefId);
  }
  if (filter.status) {
    where.push("status = ?");
    params.push(filter.status);
  }
  const sql = `SELECT * FROM concepts ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC, term COLLATE NOCASE`;
  return all<ConceptRow>(db, sql, ...params).map(toConcept);
}

export function setConceptStatus(db: Db, id: string, status: ConceptStatus, now = Date.now()): void {
  db.prepare("UPDATE concepts SET status = ?, updated_at = ? WHERE id = ?").run(status, now, id);
}

export function listFlashcards(db: Db, briefId: string): Flashcard[] {
  return all<{ id: string; course_id: string; brief_id: string | null; front: string; back: string; refs_json: string }>(
    db,
    "SELECT * FROM flashcards WHERE brief_id = ? ORDER BY created_at, rowid",
    briefId,
  ).map((r) => ({ id: r.id, courseId: r.course_id, briefId: r.brief_id, front: r.front, back: r.back, refs: JSON.parse(r.refs_json) as PageRef[] }));
}

type QuestionRow = { id: string; course_id: string; brief_id: string | null; question: string; kind: QuestionKind; refs_json: string; created_at: number };

const toQuestion = (r: QuestionRow): PracticeQuestion => ({
  id: r.id,
  courseId: r.course_id,
  briefId: r.brief_id,
  question: r.question,
  kind: r.kind,
  refs: JSON.parse(r.refs_json) as PageRef[],
  createdAt: r.created_at,
});

export function listQuestions(db: Db, filter: { courseId?: string; briefId?: string } = {}): PracticeQuestion[] {
  if (filter.briefId) return all<QuestionRow>(db, "SELECT * FROM practice_questions WHERE brief_id = ? ORDER BY created_at, rowid", filter.briefId).map(toQuestion);
  if (filter.courseId) return all<QuestionRow>(db, "SELECT * FROM practice_questions WHERE course_id = ? ORDER BY created_at DESC, rowid", filter.courseId).map(toQuestion);
  return all<QuestionRow>(db, "SELECT * FROM practice_questions ORDER BY created_at DESC, rowid").map(toQuestion);
}

export function getQuestion(db: Db, id: string): PracticeQuestion | null {
  const row = one<QuestionRow>(db, "SELECT * FROM practice_questions WHERE id = ?", id);
  return row ? toQuestion(row) : null;
}

// The owner's own question, with no page reference.
export function addQuestion(db: Db, input: { courseId: string; question: string; kind: QuestionKind }, now = Date.now()): PracticeQuestion {
  const id = randomUUID();
  db.prepare("INSERT INTO practice_questions (id, course_id, brief_id, question, kind, refs_json, created_at) VALUES (?, ?, NULL, ?, ?, '[]', ?)").run(
    id,
    input.courseId,
    input.question,
    input.kind,
    now,
  );
  return getQuestion(db, id) as PracticeQuestion;
}

export function deleteQuestion(db: Db, id: string): void {
  db.prepare("DELETE FROM practice_questions WHERE id = ?").run(id);
}

export function addAttempt(db: Db, input: { questionId: string; answer: string; assessment: Assessment; model: string }, now = Date.now()): Attempt {
  const id = randomUUID();
  db.prepare("INSERT INTO practice_attempts (id, question_id, answer, assessment_json, model, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    id,
    input.questionId,
    input.answer,
    JSON.stringify(input.assessment),
    input.model,
    now,
  );
  return { id, ...input, createdAt: now };
}

export function listAttempts(db: Db, filter: { questionId?: string; since?: number } = {}): Attempt[] {
  type Row = { id: string; question_id: string; answer: string; assessment_json: string; model: string; created_at: number };
  const rows = filter.questionId
    ? all<Row>(db, "SELECT * FROM practice_attempts WHERE question_id = ? ORDER BY created_at DESC", filter.questionId)
    : all<Row>(db, "SELECT * FROM practice_attempts WHERE created_at >= ? ORDER BY created_at DESC", filter.since ?? 0);
  return rows.map((r) => ({
    id: r.id,
    questionId: r.question_id,
    answer: r.answer,
    assessment: JSON.parse(r.assessment_json) as Assessment,
    model: r.model,
    createdAt: r.created_at,
  }));
}

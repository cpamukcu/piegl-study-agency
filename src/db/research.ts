// Server-only: research questions, the owner's sources, and labelled notes.
// Only owner actions call addSource and verifySource; no AI code path writes to the sources table.
import { randomUUID } from "node:crypto";
import { all, one, type Db } from "@/db/connection";

export type ResearchPlan = {
  subquestions: string[];
  searchTerms: string[];
  perspectives: string[];
  whereToLook: string[];
  steps: string[];
};

export type ResearchProject = {
  id: string;
  courseId: string | null;
  question: string;
  plan: ResearchPlan | null;
  planModel: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Source = {
  id: string;
  projectId: string;
  title: string;
  authors: string | null;
  year: string | null;
  locator: string | null;
  notes: string | null;
  relevance: 1 | 2 | 3;
  verifiedAt: number | null;
  createdAt: number;
};

export const NOTE_LABELS = ["mine", "from-source", "ai-interpretation"] as const;
export type NoteLabel = (typeof NOTE_LABELS)[number];

export type Note = { id: string; projectId: string; body: string; label: NoteLabel; sourceId: string | null; createdAt: number };

type ProjectRow = { id: string; course_id: string | null; question: string; plan_json: string | null; plan_model: string | null; created_at: number; updated_at: number };

const toProject = (r: ProjectRow): ResearchProject => ({
  id: r.id,
  courseId: r.course_id,
  question: r.question,
  plan: r.plan_json ? (JSON.parse(r.plan_json) as ResearchPlan) : null,
  planModel: r.plan_model,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function createProject(db: Db, input: { question: string; courseId: string | null }, now = Date.now()): ResearchProject {
  const id = randomUUID();
  db.prepare("INSERT INTO research_projects (id, course_id, question, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, input.courseId, input.question, now, now);
  return getProject(db, id) as ResearchProject;
}

export function getProject(db: Db, id: string): ResearchProject | null {
  const row = one<ProjectRow>(db, "SELECT * FROM research_projects WHERE id = ?", id);
  return row ? toProject(row) : null;
}

export function listProjects(db: Db): ResearchProject[] {
  return all<ProjectRow>(db, "SELECT * FROM research_projects ORDER BY updated_at DESC").map(toProject);
}

export function deleteProject(db: Db, id: string): void {
  db.prepare("DELETE FROM research_projects WHERE id = ?").run(id);
}

export function setPlan(db: Db, id: string, plan: ResearchPlan, model: string, now = Date.now()): void {
  db.prepare("UPDATE research_projects SET plan_json = ?, plan_model = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(plan), model, now, id);
}

const touch = (db: Db, projectId: string, now: number) => db.prepare("UPDATE research_projects SET updated_at = ? WHERE id = ?").run(now, projectId);

type SourceRow = {
  id: string;
  project_id: string;
  title: string;
  authors: string | null;
  year: string | null;
  locator: string | null;
  notes: string | null;
  relevance: 1 | 2 | 3;
  verified_at: number | null;
  created_at: number;
};

const toSource = (r: SourceRow): Source => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  authors: r.authors,
  year: r.year,
  locator: r.locator,
  notes: r.notes,
  relevance: r.relevance,
  verifiedAt: r.verified_at,
  createdAt: r.created_at,
});

export type SourceInput = { title: string; authors: string | null; year: string | null; locator: string | null; notes: string | null; relevance: 1 | 2 | 3 };

export function addSource(db: Db, projectId: string, input: SourceInput, now = Date.now()): Source {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO sources (id, project_id, title, authors, year, locator, notes, relevance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(id, projectId, input.title, input.authors, input.year, input.locator, input.notes, input.relevance, now);
  touch(db, projectId, now);
  return toSource(one<SourceRow>(db, "SELECT * FROM sources WHERE id = ?", id) as SourceRow);
}

export function listSources(db: Db, projectId: string): Source[] {
  return all<SourceRow>(db, "SELECT * FROM sources WHERE project_id = ? ORDER BY relevance DESC, created_at", projectId).map(toSource);
}

// Verified means the owner has opened and checked the source themselves.
export function setSourceVerified(db: Db, id: string, verified: boolean, now = Date.now()): void {
  db.prepare("UPDATE sources SET verified_at = ? WHERE id = ?").run(verified ? now : null, id);
}

export function deleteSource(db: Db, id: string): void {
  db.prepare("DELETE FROM sources WHERE id = ?").run(id);
}

type NoteRow = { id: string; project_id: string; body: string; label: NoteLabel; source_id: string | null; created_at: number };

export function addNote(db: Db, projectId: string, input: { body: string; label: NoteLabel; sourceId: string | null }, now = Date.now()): Note {
  if (input.label === "from-source" && !input.sourceId) throw new Error("A note from a source needs that source.");
  const id = randomUUID();
  db.prepare("INSERT INTO notes (id, project_id, body, label, source_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    id,
    projectId,
    input.body,
    input.label,
    input.label === "from-source" ? input.sourceId : null,
    now,
  );
  touch(db, projectId, now);
  return { id, projectId, ...input, sourceId: input.label === "from-source" ? input.sourceId : null, createdAt: now };
}

export function listNotes(db: Db, projectId: string): Note[] {
  return all<NoteRow>(db, "SELECT * FROM notes WHERE project_id = ? ORDER BY created_at DESC", projectId).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    body: r.body,
    label: r.label,
    sourceId: r.source_id,
    createdAt: r.created_at,
  }));
}

export function deleteNote(db: Db, id: string): void {
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
}

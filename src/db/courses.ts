import { randomUUID } from "node:crypto";
import { all, one, type Db } from "@/db/connection";

export const COURSE_COLORS = ["#2f5d62", "#7a4e2d", "#4b5d8a", "#6b4f7a", "#3f6b45", "#8a5a44", "#5a6b2f", "#2d6a7a"] as const;

export type Course = {
  id: string;
  title: string;
  code: string | null;
  instructor: string | null;
  semester: string | null;
  color: string;
  links: string[];
  notes: string | null;
  aiAllowed: boolean;
  source: "manual" | "zju";
  externalId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CourseInput = {
  title: string;
  code?: string | null;
  instructor?: string | null;
  semester?: string | null;
  color?: string;
  links?: string[];
  notes?: string | null;
};

type CourseRow = {
  id: string;
  title: string;
  code: string | null;
  instructor: string | null;
  semester: string | null;
  color: string;
  links_json: string;
  notes: string | null;
  ai_allowed: number;
  source: "manual" | "zju";
  external_id: string | null;
  created_at: number;
  updated_at: number;
};

function toCourse(r: CourseRow): Course {
  return {
    id: r.id,
    title: r.title,
    code: r.code,
    instructor: r.instructor,
    semester: r.semester,
    color: r.color,
    links: JSON.parse(r.links_json) as string[],
    notes: r.notes,
    aiAllowed: r.ai_allowed === 1,
    source: r.source,
    externalId: r.external_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listCourses(db: Db): Course[] {
  return all<CourseRow>(db, "SELECT * FROM courses ORDER BY title COLLATE NOCASE").map(toCourse);
}

export function getCourse(db: Db, id: string): Course | null {
  const row = one<CourseRow>(db, "SELECT * FROM courses WHERE id = ?", id);
  return row ? toCourse(row) : null;
}

export function getCourseByExternalId(db: Db, externalId: string): Course | null {
  const row = one<CourseRow>(db, "SELECT * FROM courses WHERE external_id = ?", externalId);
  return row ? toCourse(row) : null;
}

type CreateOptions = { now?: number; source?: "manual" | "zju"; externalId?: string | null };

export function createCourse(db: Db, input: CourseInput, options: CreateOptions = {}): Course {
  const now = options.now ?? Date.now();
  const id = randomUUID();
  const count = one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM courses")?.n ?? 0;
  db.prepare(
    `INSERT INTO courses (id, title, code, instructor, semester, color, links_json, notes, source, external_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.title,
    input.code ?? null,
    input.instructor ?? null,
    input.semester ?? null,
    input.color ?? COURSE_COLORS[count % COURSE_COLORS.length],
    JSON.stringify(input.links ?? []),
    input.notes ?? null,
    options.source ?? "manual",
    options.externalId ?? null,
    now,
    now,
  );
  return getCourse(db, id) as Course;
}

export function updateCourse(db: Db, id: string, input: CourseInput, now = Date.now()): Course {
  const existing = getCourse(db, id);
  if (!existing) throw new Error(`No course with id ${id}`);
  db.prepare(
    `UPDATE courses SET title = ?, code = ?, instructor = ?, semester = ?, color = ?, links_json = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.title,
    input.code ?? null,
    input.instructor ?? null,
    input.semester ?? null,
    input.color ?? existing.color,
    JSON.stringify(input.links ?? []),
    input.notes ?? null,
    now,
    id,
  );
  return getCourse(db, id) as Course;
}

export function deleteCourse(db: Db, id: string): void {
  db.prepare("DELETE FROM courses WHERE id = ?").run(id);
}

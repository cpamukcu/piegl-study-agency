import { randomUUID } from "node:crypto";
import { all, one, type Db } from "@/db/connection";

export const TASK_TYPES = ["assignment", "reading", "presentation", "exam", "personal", "prep"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ["todo", "doing", "done", "postponed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Importance = 1 | 2 | 3;
export type TaskSource = "manual" | "zju" | "rule";

export type Task = {
  id: string;
  courseId: string | null;
  type: TaskType;
  title: string;
  dueAt: number | null;
  estMinutes: number | null;
  importance: Importance;
  status: TaskStatus;
  notes: string | null;
  source: TaskSource;
  externalId: string | null;
  ruleId: string | null;
  occurrenceKey: string | null;
  completedAt: number | null;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type TaskInput = {
  title: string;
  type: TaskType;
  courseId?: string | null;
  dueAt?: number | null;
  estMinutes?: number | null;
  importance?: Importance;
  notes?: string | null;
};

type TaskRow = {
  id: string;
  course_id: string | null;
  type: TaskType;
  title: string;
  due_at: number | null;
  est_minutes: number | null;
  importance: Importance;
  status: TaskStatus;
  notes: string | null;
  source: TaskSource;
  external_id: string | null;
  rule_id: string | null;
  occurrence_key: string | null;
  completed_at: number | null;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
};

function toTask(r: TaskRow): Task {
  return {
    id: r.id,
    courseId: r.course_id,
    type: r.type,
    title: r.title,
    dueAt: r.due_at,
    estMinutes: r.est_minutes,
    importance: r.importance,
    status: r.status,
    notes: r.notes,
    source: r.source,
    externalId: r.external_id,
    ruleId: r.rule_id,
    occurrenceKey: r.occurrence_key,
    completedAt: r.completed_at,
    deletedAt: r.deleted_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function isOpen(task: Pick<Task, "status">): boolean {
  return task.status !== "done";
}

export function listTasks(db: Db, options: { includeDone?: boolean; courseId?: string } = {}): Task[] {
  const where: string[] = ["deleted_at IS NULL"];
  const params: string[] = [];
  if (!options.includeDone) where.push("status != 'done'");
  if (options.courseId) {
    where.push("course_id = ?");
    params.push(options.courseId);
  }
  const filter = `WHERE ${where.join(" AND ")}`;
  return all<TaskRow>(db, `SELECT * FROM tasks ${filter} ORDER BY due_at IS NULL, due_at, created_at`, ...params).map(
    toTask,
  );
}

export function getTask(db: Db, id: string): Task | null {
  const row = one<TaskRow>(db, "SELECT * FROM tasks WHERE id = ?", id);
  return row ? toTask(row) : null;
}

export function getTaskByExternalId(db: Db, externalId: string): Task | null {
  const row = one<TaskRow>(db, "SELECT * FROM tasks WHERE external_id = ?", externalId);
  return row ? toTask(row) : null;
}

type CreateOptions = { now?: number; source?: TaskSource; externalId?: string | null };

export function createTask(db: Db, input: TaskInput, options: CreateOptions = {}): Task {
  const now = options.now ?? Date.now();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO tasks (id, course_id, type, title, due_at, est_minutes, importance, notes, source, external_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.courseId ?? null,
    input.type,
    input.title,
    input.dueAt ?? null,
    input.estMinutes ?? null,
    input.importance ?? 2,
    input.notes ?? null,
    options.source ?? "manual",
    options.externalId ?? null,
    now,
    now,
  );
  return getTask(db, id) as Task;
}

export function updateTask(db: Db, id: string, input: TaskInput, now = Date.now()): Task {
  db.prepare(
    `UPDATE tasks SET title = ?, type = ?, course_id = ?, due_at = ?, est_minutes = ?, importance = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.title,
    input.type,
    input.courseId ?? null,
    input.dueAt ?? null,
    input.estMinutes ?? null,
    input.importance ?? 2,
    input.notes ?? null,
    now,
    id,
  );
  return getTask(db, id) as Task;
}

export function setTaskStatus(db: Db, id: string, status: TaskStatus, now = Date.now()): void {
  db.prepare("UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?").run(
    status,
    status === "done" ? now : null,
    now,
    id,
  );
}

export function postponeTask(db: Db, id: string, byMs: number, now = Date.now()): void {
  db.prepare("UPDATE tasks SET due_at = COALESCE(due_at, ?) + ?, status = 'postponed', updated_at = ? WHERE id = ?").run(
    now,
    byMs,
    now,
    id,
  );
}

// Soft delete: the row stays so prep routines and ZJU imports do not create it again.
export function deleteTask(db: Db, id: string, now = Date.now()): void {
  db.prepare("UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
}

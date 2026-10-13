// Server-only: reads snapshot files from DATA_DIR/snapshots and writes them into the database.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { z } from "zod";
import { one, transaction, type Db } from "@/db/connection";
import { createCourse, getCourseByExternalId, listCourses, type CourseInput } from "@/db/courses";
import { addMeetingTime, deleteMeetingTimesByExternalPrefix } from "@/db/meetings";
import { createTask, getTaskByExternalId } from "@/db/tasks";
import { upsertTerm } from "@/db/terms";
import { tronclassSnapshotSchema, yjsySnapshotSchema } from "@/import/schemas";
import { ImportError } from "@/import/errors";
import { classNoFromCode, mapTronclass } from "@/import/tronclass";
import { loadCourseNames, translateNote, translatePerson, translatePlace, translateSemester } from "@/import/translate";
import { mapYjsy } from "@/import/yjsy";

export { ImportError };

export type ImportSummary = {
  files: string[];
  coursesAdded: number;
  tasksAdded: number;
  tasksUpdated: number;
  meetings: number;
  skippedPast: number;
};

const TRONCLASS_PREFIX = "courses-zju-";
const YJSY_PREFIX = "timetable-yjsy-";

// Snapshot names end in a date ("…-YYYY-MM-DD.json"); slice(-15) is that date plus ".json".
export function listSnapshotFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json") && (name.startsWith(TRONCLASS_PREFIX) || name.startsWith(YJSY_PREFIX)))
    .sort((a, b) => b.slice(-15).localeCompare(a.slice(-15)) || b.localeCompare(a));
}

export function latestSnapshot(dir: string, prefix: string): string | null {
  if (!existsSync(dir)) return null;
  const names = readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .sort();
  const newest = names.at(-1);
  return newest ? path.join(dir, newest) : null;
}

function readSnapshot<T>(file: string, schema: z.ZodType<T>): T {
  const name = path.basename(file);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new ImportError(`${name} is not valid JSON.`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? issue.path.join(".") : "top level";
    throw new ImportError(`${name} has an unexpected format (${where}: ${issue?.message ?? "invalid"}).`);
  }
  return parsed.data;
}

// Moves everything from one course onto another, keeps the first one's notes if the target has none,
// then removes the emptied course.
function mergeCourse(db: Db, fromId: string, toId: string): void {
  for (const table of ["tasks", "meeting_times", "recurrence_rules"]) {
    db.prepare(`UPDATE ${table} SET course_id = ? WHERE course_id = ?`).run(toId, fromId);
  }
  db.prepare("UPDATE courses SET notes = COALESCE(notes, (SELECT notes FROM courses WHERE id = ?)) WHERE id = ?").run(fromId, toId);
  db.prepare("DELETE FROM courses WHERE id = ?").run(fromId);
}

// A field follows ZJU only while it still holds what ZJU sent last time; an owner edit wins.
function followZju<T>(current: T, lastImported: T, incoming: T): T {
  return current === lastImported ? incoming : current;
}

export function importSnapshots(db: Db, dir: string, now = Date.now()): ImportSummary {
  const tronclassFile = latestSnapshot(dir, TRONCLASS_PREFIX);
  const yjsyFile = latestSnapshot(dir, YJSY_PREFIX);
  // Validate everything before writing anything.
  const tronclass = tronclassFile ? mapTronclass(readSnapshot(tronclassFile, tronclassSnapshotSchema), now) : null;
  const yjsy = yjsyFile ? mapYjsy(readSnapshot(yjsyFile, yjsySnapshotSchema)) : null;
  const names = loadCourseNames(dir);
  const english = (title: string) => names[title] ?? title;

  const summary: ImportSummary = {
    files: [tronclassFile, yjsyFile].filter((f): f is string => f !== null).map((f) => path.basename(f)),
    coursesAdded: 0,
    tasksAdded: 0,
    tasksUpdated: 0,
    meetings: 0,
    skippedPast: tronclass?.skippedPast ?? 0,
  };

  transaction(db, () => {
    const courseIdByExternal = new Map<string, string>();
    const courseIdByClassNo = new Map<string, string>();

    const ensureCourse = (externalId: string, input: CourseInput, classNo: string | null, originalTitle: string): string => {
      const existing = getCourseByExternalId(db, externalId);
      let id: string;
      if (existing) {
        // Switch to the English title only if the owner has not renamed the course.
        if (existing.title === originalTitle && input.title !== originalTitle) {
          db.prepare("UPDATE courses SET title = ? WHERE id = ?").run(input.title, existing.id);
        }
        const last = one<{ code: string | null; instructor: string | null; semester: string | null; source_code: string | null; source_instructor: string | null; source_semester: string | null }>(
          db,
          "SELECT code, instructor, semester, source_code, source_instructor, source_semester FROM courses WHERE id = ?",
          existing.id,
        );
        const code = input.code ?? null;
        const instructor = input.instructor ?? null;
        const semester = input.semester ?? null;
        db.prepare(
          `UPDATE courses SET code = ?, instructor = ?, semester = ?, source_code = ?, source_instructor = ?, source_semester = ?, updated_at = ?
           WHERE id = ?`,
        ).run(
          followZju(last?.code ?? null, last?.source_code ?? null, code),
          followZju(last?.instructor ?? null, last?.source_instructor ?? null, instructor),
          followZju(last?.semester ?? null, last?.source_semester ?? null, semester),
          code,
          instructor,
          semester,
          now,
          existing.id,
        );
        id = existing.id;
      } else {
        id = createCourse(db, input, { now, source: "zju", externalId }).id;
        db.prepare("UPDATE courses SET source_code = code, source_instructor = instructor, source_semester = semester WHERE id = ?").run(id);
        summary.coursesAdded += 1;
      }
      courseIdByExternal.set(externalId, id);
      if (classNo) courseIdByClassNo.set(classNo, id);
      return id;
    };

    for (const c of tronclass?.courses ?? []) {
      ensureCourse(
        c.externalId,
        { title: english(c.title), code: c.code, instructor: c.instructor, semester: translateSemester(c.semester) },
        c.classNo,
        c.title,
      );
    }
    // A Courses@ZJU course wins its class number. If the timetable created a course for that
    // number earlier (before Courses@ZJU listed it), merge it in so there is only one course.
    const zjuCourseByClassNo = new Map<string, string>();
    for (const c of listCourses(db)) {
      const classNo = classNoFromCode(c.code);
      if (classNo && c.externalId?.startsWith("tc:course:")) zjuCourseByClassNo.set(classNo, c.id);
    }
    for (const [classNo, targetId] of zjuCourseByClassNo) {
      const early = getCourseByExternalId(db, `yjsy:class:${classNo}`);
      if (early && early.id !== targetId) mergeCourse(db, early.id, targetId);
      courseIdByClassNo.set(classNo, targetId);
    }
    for (const c of listCourses(db)) {
      const classNo = classNoFromCode(c.code);
      if (classNo && !courseIdByClassNo.has(classNo)) courseIdByClassNo.set(classNo, c.id);
    }

    if (yjsy) {
      upsertTerm(db, yjsy.term);
      // A class number that matches a Courses@ZJU course uses that course. Otherwise the
      // timetable owns the course, and it is created or refreshed on every import.
      const courseFor = (classNo: string, title: string, teacher: string | null, notes: string | null = null) => {
        const externalId = `yjsy:class:${classNo}`;
        const zju = zjuCourseByClassNo.get(classNo);
        if (zju) return zju;
        const linked = courseIdByClassNo.get(classNo);
        if (linked && !getCourseByExternalId(db, externalId)) return linked;
        return ensureCourse(
          externalId,
          { title: english(title), code: classNo, instructor: translatePerson(teacher), notes: translateNote(notes) },
          classNo,
          title,
        );
      };

      deleteMeetingTimesByExternalPrefix(db, "yjsy:");
      for (const m of yjsy.meetings) {
        addMeetingTime(db, {
          courseId: courseFor(m.classNo, m.courseTitle, m.teacher),
          termId: yjsy.term.id,
          weekday: m.weekday,
          startMinute: m.startMinute,
          endMinute: m.endMinute,
          room: translatePlace(m.room),
          weeks: m.weeks,
          externalId: m.externalId,
        });
        summary.meetings += 1;
      }
      for (const n of yjsy.noticeCourses) courseFor(n.classNo, n.title, n.teacher, n.note);
    }

    for (const t of tronclass?.tasks ?? []) {
      const courseId = courseIdByExternal.get(t.courseExternalId) ?? null;
      const existing = getTaskByExternalId(db, t.externalId);
      if (existing) {
        // Titles stay as the owner left them. The due date follows ZJU unless the owner changed it.
        const last = one<{ due_at: number | null; source_due_at: number | null }>(db, "SELECT due_at, source_due_at FROM tasks WHERE id = ?", existing.id);
        db.prepare("UPDATE tasks SET due_at = ?, source_due_at = ?, course_id = ?, updated_at = ? WHERE id = ?").run(
          followZju(last?.due_at ?? null, last?.source_due_at ?? null, t.dueAt),
          t.dueAt,
          courseId,
          now,
          existing.id,
        );
        summary.tasksUpdated += 1;
      } else {
        const created = createTask(db, { title: t.title, type: t.type, courseId, dueAt: t.dueAt, notes: t.notes }, { now, source: "zju", externalId: t.externalId });
        db.prepare("UPDATE tasks SET source_due_at = due_at WHERE id = ?").run(created.id);
        summary.tasksAdded += 1;
      }
    }

    const record = db.prepare(
      "INSERT INTO import_runs (id, source, file_name, imported_at, counts_json) VALUES (?, ?, ?, ?, ?)",
    );
    if (tronclassFile) record.run(randomUUID(), "courses.zju.edu.cn", path.basename(tronclassFile), now, JSON.stringify(summary));
    if (yjsyFile) record.run(randomUUID(), "yjsy.zju.edu.cn", path.basename(yjsyFile), now, JSON.stringify(summary));
  });

  return summary;
}

export function lastImport(db: Db): { fileName: string; importedAt: number } | null {
  const row = one<{ file_name: string; imported_at: number }>(
    db,
    "SELECT file_name, imported_at FROM import_runs ORDER BY imported_at DESC, rowid DESC LIMIT 1",
  );
  return row ? { fileName: row.file_name, importedAt: row.imported_at } : null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function describeImport(summary: ImportSummary): string {
  if (summary.files.length === 0) return "No snapshot files found.";
  const sentence = `Added ${plural(summary.coursesAdded, "course")} and ${plural(summary.tasksAdded, "task")}, updated ${plural(summary.tasksUpdated, "task")}, saved ${plural(summary.meetings, "class time")}.`;
  if (summary.skippedPast === 0) return sentence;
  const skipped = summary.skippedPast === 1 ? "1 past item that was" : `${summary.skippedPast} past items that were`;
  return `${sentence} Skipped ${skipped} not on your ZJU to-do list.`;
}

import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { all } from "@/db/connection";
import { getCourseByExternalId, listCourses, updateCourse } from "@/db/courses";
import { listMeetingTimes } from "@/db/meetings";
import { createRule, listRules } from "@/db/rules";
import { deleteTask, getTaskByExternalId, listTasks, postponeTask, setTaskStatus, updateTask } from "@/db/tasks";
import { listTerms } from "@/db/terms";
import { ImportError, describeImport, importSnapshots, lastImport, latestSnapshot, listSnapshotFiles } from "@/import/run";
import { COURSE_NAMES_FILE } from "@/import/translate";
import { memoryDb } from "../helpers/db";

const NOW = Date.parse("2026-10-12T04:00:00Z");
let dir: string;

function addSamples(target: string) {
  copyFileSync("sample-data/courses-zju-sample.json", path.join(target, "courses-zju-2026-10-12.json"));
  copyFileSync("sample-data/timetable-yjsy-sample.json", path.join(target, "timetable-yjsy-2026-10-12.json"));
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-import-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("finding snapshot files", () => {
  it("lists json snapshots newest first and picks the newest per source", () => {
    addSamples(dir);
    writeFileSync(path.join(dir, "courses-zju-2026-09-01.json"), "{}");
    writeFileSync(path.join(dir, "notes.txt"), "x");
    expect(listSnapshotFiles(dir)).toEqual([
      "timetable-yjsy-2026-10-12.json",
      "courses-zju-2026-10-12.json",
      "courses-zju-2026-09-01.json",
    ]);
    expect(latestSnapshot(dir, "courses-zju-")).toBe(path.join(dir, "courses-zju-2026-10-12.json"));
    expect(latestSnapshot(path.join(dir, "missing"), "courses-zju-")).toBeNull();
  });
});

describe("importSnapshots", () => {
  it("imports courses, the term, class times and tasks", () => {
    addSamples(dir);
    const db = memoryDb();
    const summary = importSnapshots(db, dir, NOW);
    expect(summary).toEqual({
      files: ["courses-zju-2026-10-12.json", "timetable-yjsy-2026-10-12.json"],
      coursesAdded: 4,
      tasksAdded: 4,
      tasksUpdated: 0,
      meetings: 3,
      skippedPast: 1,
    });
    expect(listCourses(db).map((c) => c.title)).toEqual(["Demo Chinese", "Demo Seminar", "Demo Strategy", "Demo Workshop"]);
    expect(listTerms(db).map((t) => t.id)).toEqual(["yjsy:2026-12"]);

    const strategy = getCourseByExternalId(db, "tc:course:900001");
    expect(listMeetingTimes(db, strategy?.id).map((m) => m.room)).toEqual(["Demo Hall 101"]);
    expect(getCourseByExternalId(db, "yjsy:class:9000004001")?.notes).toBe("Room C1 (23 Oct in B2)");
    expect(getTaskByExternalId(db, "tc:exam:920001")).toMatchObject({ type: "exam", courseId: strategy?.id, source: "zju" });
    expect(lastImport(db)).toEqual({ fileName: "timetable-yjsy-2026-10-12.json", importedAt: NOW });
  });

  it("is safe to run again and keeps the owner's edits", () => {
    addSamples(dir);
    const db = memoryDb();
    importSnapshots(db, dir, NOW);

    const strategy = getCourseByExternalId(db, "tc:course:900001");
    if (!strategy) throw new Error("missing course");
    updateCourse(db, strategy.id, { title: "Strategy (renamed)", color: "#111111" }, NOW);
    const essay = getTaskByExternalId(db, "tc:activity:910001");
    if (!essay) throw new Error("missing task");
    updateTask(db, essay.id, { title: essay.title, type: essay.type, courseId: essay.courseId, dueAt: essay.dueAt, importance: 3, estMinutes: 120, notes: "outline first" }, NOW);
    const quiz = getTaskByExternalId(db, "tc:exam:920001");
    if (!quiz) throw new Error("missing task");
    setTaskStatus(db, quiz.id, "done", NOW);

    const again = importSnapshots(db, dir, NOW + 1000);
    expect(again).toMatchObject({ coursesAdded: 0, tasksAdded: 0, tasksUpdated: 4, meetings: 3 });
    expect(listCourses(db)).toHaveLength(4);
    expect(listMeetingTimes(db)).toHaveLength(3);
    expect(listTasks(db, { includeDone: true })).toHaveLength(4);
    expect(getCourseByExternalId(db, "tc:course:900001")).toMatchObject({ title: "Strategy (renamed)", color: "#111111" });
    expect(getTaskByExternalId(db, "tc:activity:910001")).toMatchObject({ importance: 3, estMinutes: 120, notes: "outline first" });
    expect(getTaskByExternalId(db, "tc:exam:920001")?.status).toBe("done");
  });

  it("uses English course names, translates rooms and semesters, and keeps renamed titles", () => {
    addSamples(dir);
    const db = memoryDb();
    importSnapshots(db, dir, NOW);
    const seminar = getCourseByExternalId(db, "yjsy:class:9000003001");
    if (!seminar) throw new Error("missing course");
    updateCourse(db, seminar.id, { title: "My seminar" }, NOW);

    writeFileSync(
      path.join(dir, COURSE_NAMES_FILE),
      JSON.stringify({ "Demo Strategy": "Strategy in English", "Demo Seminar": "Seminar in English" }),
    );
    importSnapshots(db, dir, NOW + 1000);

    expect(getCourseByExternalId(db, "tc:course:900001")?.title).toBe("Strategy in English");
    expect(getCourseByExternalId(db, "yjsy:class:9000003001")?.title).toBe("My seminar");
    expect(getCourseByExternalId(db, "tc:course:900002")?.semester).toBe("2026–2027 Autumn-Winter");
  });

  it("refreshes timetable-only courses on a later import", () => {
    addSamples(dir);
    const db = memoryDb();
    importSnapshots(db, dir, NOW);
    writeFileSync(path.join(dir, COURSE_NAMES_FILE), JSON.stringify({ "Demo Seminar": "Seminar in English" }));
    importSnapshots(db, dir, NOW + 1000);
    expect(getCourseByExternalId(db, "yjsy:class:9000003001")?.title).toBe("Seminar in English");
  });

  it("keeps a task title the owner changed when importing again", () => {
    addSamples(dir);
    const db = memoryDb();
    importSnapshots(db, dir, NOW);
    const task = getTaskByExternalId(db, "tc:activity:910010");
    if (!task) throw new Error("missing task");
    updateTask(db, task.id, { title: "Write characters for lessons 2 and 3", type: task.type, courseId: task.courseId, dueAt: task.dueAt }, NOW);
    importSnapshots(db, dir, NOW + 1000);
    expect(getTaskByExternalId(db, "tc:activity:910010")?.title).toBe("Write characters for lessons 2 and 3");
  });

  it("does not bring back a ZJU task the owner deleted", () => {
    addSamples(dir);
    const db = memoryDb();
    importSnapshots(db, dir, NOW);
    const quiz = getTaskByExternalId(db, "tc:exam:920001");
    if (!quiz) throw new Error("missing task");
    deleteTask(db, quiz.id, NOW);
    expect(importSnapshots(db, dir, NOW + 1000).tasksAdded).toBe(0);
    expect(listTasks(db, { includeDone: true }).map((t) => t.externalId)).not.toContain("tc:exam:920001");
  });

  it("keeps an instructor and a due date the owner changed", () => {
    addSamples(dir);
    const db = memoryDb();
    importSnapshots(db, dir, NOW);
    const strategy = getCourseByExternalId(db, "tc:course:900001");
    if (!strategy) throw new Error("missing course");
    updateCourse(db, strategy.id, { title: strategy.title, code: strategy.code, instructor: "Prof. Real Name", semester: strategy.semester, color: strategy.color }, NOW);
    const quiz = getTaskByExternalId(db, "tc:exam:920001");
    if (!quiz?.dueAt) throw new Error("missing task");
    postponeTask(db, quiz.id, 86_400_000, NOW);

    importSnapshots(db, dir, NOW + 1000);
    expect(getCourseByExternalId(db, "tc:course:900001")?.instructor).toBe("Prof. Real Name");
    expect(getTaskByExternalId(db, "tc:exam:920001")?.dueAt).toBe(quiz.dueAt + 86_400_000);
  });

  it("follows ZJU's new due date when the owner did not change it", () => {
    addSamples(dir);
    const db = memoryDb();
    importSnapshots(db, dir, NOW);
    const snapshot = JSON.parse(readFileSync(path.join(dir, "courses-zju-2026-10-12.json"), "utf8"));
    snapshot.courses[0].exams[0].end_time = "2026-10-16T14:00:00Z";
    writeFileSync(path.join(dir, "courses-zju-2026-10-13.json"), JSON.stringify(snapshot));
    importSnapshots(db, dir, NOW + 1000);
    expect(getTaskByExternalId(db, "tc:exam:920001")?.dueAt).toBe(Date.parse("2026-10-16T14:00:00Z"));
  });

  it("fails clearly on a malformed snapshot and changes nothing", () => {
    addSamples(dir);
    writeFileSync(path.join(dir, "timetable-yjsy-2026-10-13.json"), JSON.stringify({ calendar: { year: 2026 } }));
    const db = memoryDb();
    expect(() => importSnapshots(db, dir, NOW)).toThrow(ImportError);
    expect(() => importSnapshots(db, dir, NOW)).toThrow(/timetable-yjsy-2026-10-13\.json has an unexpected format/);
    expect(listCourses(db)).toEqual([]);
    expect(all(db, "SELECT * FROM import_runs")).toEqual([]);
  });

  it("merges a timetable-only course into its Courses@ZJU course when that appears later", () => {
    copyFileSync("sample-data/timetable-yjsy-sample.json", path.join(dir, "timetable-yjsy-2026-10-12.json"));
    const db = memoryDb();
    importSnapshots(db, dir, NOW);
    const early = getCourseByExternalId(db, "yjsy:class:9000001001");
    if (!early) throw new Error("missing course");
    createRule(db, { courseId: early.id, title: "Prep", leadMinutes: 60 });

    copyFileSync("sample-data/courses-zju-sample.json", path.join(dir, "courses-zju-2026-10-12.json"));
    importSnapshots(db, dir, NOW + 1000);

    const strategies = listCourses(db).filter((c) => c.title === "Demo Strategy");
    expect(strategies).toHaveLength(1);
    expect(strategies[0].externalId).toBe("tc:course:900001");
    expect(listMeetingTimes(db, strategies[0].id)).toHaveLength(1);
    expect(listTasks(db, { courseId: strategies[0].id })).toHaveLength(3);
    expect(listRules(db, strategies[0].id)).toHaveLength(1);
    expect(getCourseByExternalId(db, "yjsy:class:9000001001")).toBeNull();
  });

  it("refuses a timetable whose start date is not a real date", () => {
    addSamples(dir);
    const snapshot = JSON.parse(readFileSync(path.join(dir, "timetable-yjsy-2026-10-12.json"), "utf8"));
    snapshot.calendar.start = "2026/09/14";
    writeFileSync(path.join(dir, "timetable-yjsy-2026-10-12.json"), JSON.stringify(snapshot));
    const db = memoryDb();
    expect(() => importSnapshots(db, dir, NOW)).toThrow(/calendar\.start/);
    expect(listCourses(db)).toEqual([]);
  });

  it("fails clearly on a file that is not JSON", () => {
    writeFileSync(path.join(dir, "courses-zju-2026-10-12.json"), "{ not json");
    expect(() => importSnapshots(memoryDb(), dir, NOW)).toThrow(/is not valid JSON/);
  });

  it("does nothing when there are no snapshots", () => {
    const db = memoryDb();
    expect(importSnapshots(db, dir, NOW)).toEqual({ files: [], coursesAdded: 0, tasksAdded: 0, tasksUpdated: 0, meetings: 0, skippedPast: 0 });
    expect(lastImport(db)).toBeNull();
  });
});

describe("describeImport", () => {
  it("sums up an import in one sentence", () => {
    expect(describeImport({ files: ["a"], coursesAdded: 4, tasksAdded: 4, tasksUpdated: 0, meetings: 3, skippedPast: 1 })).toBe(
      "Added 4 courses and 4 tasks, updated 0 tasks, saved 3 class times. Skipped 1 past item that was not on your ZJU to-do list.",
    );
    expect(describeImport({ files: [], coursesAdded: 0, tasksAdded: 0, tasksUpdated: 0, meetings: 0, skippedPast: 0 })).toBe(
      "No snapshot files found.",
    );
  });
});

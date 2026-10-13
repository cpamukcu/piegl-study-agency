import { describe, expect, it } from "vitest";
import { COURSE_COLORS, createCourse, deleteCourse, getCourse, listCourses, updateCourse } from "@/db/courses";
import { addMeetingTime, deleteMeetingTimesByExternalPrefix, listMeetingTimes } from "@/db/meetings";
import {
  createTask,
  deleteTask,
  getTask,
  isOpen,
  listTasks,
  postponeTask,
  setTaskStatus,
  updateTask,
} from "@/db/tasks";
import { currentTerm, listTerms, upsertTerm, type Term } from "@/db/terms";
import { DAY_MS } from "@/lib/time";
import { memoryDb } from "../helpers/db";

const NOW = Date.parse("2026-10-12T04:00:00Z");

describe("courses", () => {
  it("creates courses with defaults and a palette color, sorted by title", () => {
    const db = memoryDb();
    const b = createCourse(db, { title: "beta" }, { now: NOW });
    const a = createCourse(db, { title: "Alpha", code: "X-1", links: ["https://example.edu"] }, { now: NOW });
    expect(b).toMatchObject({ color: COURSE_COLORS[0], source: "manual", aiAllowed: true, links: [] });
    expect(a).toMatchObject({ color: COURSE_COLORS[1], code: "X-1", links: ["https://example.edu"], createdAt: NOW });
    expect(listCourses(db).map((c) => c.title)).toEqual(["Alpha", "beta"]);
  });

  it("updates and deletes courses", () => {
    const db = memoryDb();
    const c = createCourse(db, { title: "Old" }, { now: NOW });
    updateCourse(db, c.id, { title: "New", instructor: "Dr. Demo", color: "#123456" }, NOW + 1);
    expect(getCourse(db, c.id)).toMatchObject({ title: "New", instructor: "Dr. Demo", color: "#123456", updatedAt: NOW + 1 });
    deleteCourse(db, c.id);
    expect(getCourse(db, c.id)).toBeNull();
  });

  it("removes a course's class times and keeps its tasks without a course", () => {
    const db = memoryDb();
    const c = createCourse(db, { title: "Demo" }, { now: NOW });
    addMeetingTime(db, { courseId: c.id, weekday: 2, startMinute: 530, endMinute: 745 });
    const t = createTask(db, { title: "Essay", type: "assignment", courseId: c.id }, { now: NOW });
    deleteCourse(db, c.id);
    expect(listMeetingTimes(db)).toEqual([]);
    expect(getTask(db, t.id)?.courseId).toBeNull();
  });
});

describe("meeting times", () => {
  it("stores weeks and lists by weekday then start", () => {
    const db = memoryDb();
    const c = createCourse(db, { title: "Demo" }, { now: NOW });
    addMeetingTime(db, { courseId: c.id, weekday: 3, startMinute: 600, endMinute: 745, room: "Hall 1" });
    addMeetingTime(db, { courseId: c.id, weekday: 1, startMinute: 805, endMinute: 1020, weeks: [1, 3, 5], externalId: "yjsy:a" });
    const list = listMeetingTimes(db, c.id);
    expect(list.map((m) => m.weekday)).toEqual([1, 3]);
    expect(list[0]).toMatchObject({ weeks: [1, 3, 5], room: null, externalId: "yjsy:a" });
    expect(deleteMeetingTimesByExternalPrefix(db, "yjsy:")).toBe(1);
    expect(listMeetingTimes(db)).toHaveLength(1);
  });
});

describe("terms", () => {
  const term = (id: string, startDate: string): Term => ({
    id,
    name: id,
    startDate,
    weeks: 18,
    periods: [{ period: 1, startMinute: 480, endMinute: 525 }],
  });

  it("inserts and then updates a term by id", () => {
    const db = memoryDb();
    upsertTerm(db, term("t", "2026-09-14"));
    upsertTerm(db, { ...term("t", "2026-09-14"), weeks: 16 });
    expect(listTerms(db)).toEqual([{ ...term("t", "2026-09-14"), weeks: 16 }]);
  });

  it("picks the term that contains now, else the latest started one", () => {
    const spring = term("spring", "2026-02-23");
    const autumn = term("autumn", "2026-09-14");
    expect(currentTerm([spring, autumn], NOW)?.id).toBe("autumn");
    expect(currentTerm([spring], NOW)?.id).toBe("spring");
    expect(currentTerm([], NOW)).toBeNull();
  });
});

describe("tasks", () => {
  it("creates tasks with defaults", () => {
    const db = memoryDb();
    const t = createTask(db, { title: "Read ch. 3", type: "reading" }, { now: NOW });
    expect(t).toMatchObject({ importance: 2, status: "todo", source: "manual", dueAt: null, courseId: null });
    expect(isOpen(t)).toBe(true);
  });

  it("lists open tasks by due date with undated last", () => {
    const db = memoryDb();
    createTask(db, { title: "undated", type: "personal" }, { now: NOW });
    createTask(db, { title: "later", type: "exam", dueAt: NOW + 5 * DAY_MS }, { now: NOW });
    createTask(db, { title: "soon", type: "assignment", dueAt: NOW + DAY_MS }, { now: NOW });
    const done = createTask(db, { title: "done", type: "assignment", dueAt: NOW }, { now: NOW });
    setTaskStatus(db, done.id, "done", NOW);
    expect(listTasks(db).map((t) => t.title)).toEqual(["soon", "later", "undated"]);
    expect(listTasks(db, { includeDone: true }).map((t) => t.title)).toEqual(["done", "soon", "later", "undated"]);
  });

  it("records completion time and clears it on reopen", () => {
    const db = memoryDb();
    const t = createTask(db, { title: "x", type: "assignment" }, { now: NOW });
    setTaskStatus(db, t.id, "done", NOW + 10);
    expect(getTask(db, t.id)).toMatchObject({ status: "done", completedAt: NOW + 10 });
    setTaskStatus(db, t.id, "todo", NOW + 20);
    expect(getTask(db, t.id)).toMatchObject({ status: "todo", completedAt: null });
  });

  it("postpones by moving the due date and marking it postponed", () => {
    const db = memoryDb();
    const dated = createTask(db, { title: "a", type: "assignment", dueAt: NOW }, { now: NOW });
    const undated = createTask(db, { title: "b", type: "assignment" }, { now: NOW });
    postponeTask(db, dated.id, DAY_MS, NOW);
    postponeTask(db, undated.id, DAY_MS, NOW);
    expect(getTask(db, dated.id)).toMatchObject({ dueAt: NOW + DAY_MS, status: "postponed" });
    expect(getTask(db, undated.id)).toMatchObject({ dueAt: NOW + DAY_MS, status: "postponed" });
  });

  it("hides deleted tasks everywhere they are listed", () => {
    const db = memoryDb();
    const t = createTask(db, { title: "gone", type: "assignment" }, { now: NOW });
    deleteTask(db, t.id, NOW + 5);
    expect(listTasks(db, { includeDone: true })).toEqual([]);
    expect(getTask(db, t.id)?.deletedAt).toBe(NOW + 5);
  });

  it("updates editable fields", () => {
    const db = memoryDb();
    const t = createTask(db, { title: "x", type: "assignment" }, { now: NOW });
    updateTask(db, t.id, { title: "y", type: "presentation", estMinutes: 90, importance: 3, notes: "slides" }, NOW + 1);
    expect(getTask(db, t.id)).toMatchObject({ title: "y", type: "presentation", estMinutes: 90, importance: 3, notes: "slides" });
  });
});

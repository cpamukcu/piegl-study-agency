import { describe, expect, it } from "vitest";
import { createCourse } from "@/db/courses";
import { addMeetingTime, deleteMeetingTime, listMeetingTimes } from "@/db/meetings";
import { createRule, deleteRule, listRules, materializePrepTasks } from "@/db/rules";
import { deleteTask, listTasks, setTaskStatus } from "@/db/tasks";
import { upsertTerm } from "@/db/terms";
import { memoryDb } from "../helpers/db";

const NOW = Date.parse("2026-10-12T04:00:00Z");

function setup() {
  const db = memoryDb();
  upsertTerm(db, { id: "t", name: "T", startDate: "2026-09-14", weeks: 18, periods: [] });
  const course = createCourse(db, { title: "Demo" }, { now: NOW });
  addMeetingTime(db, { courseId: course.id, termId: "t", weekday: 2, startMinute: 530, endMinute: 745, weeks: [5, 6, 7] });
  return { db, course };
}

describe("recurrence rules", () => {
  it("creates prep tasks for the next two weeks of classes, once", () => {
    const { db, course } = setup();
    createRule(db, { courseId: course.id, title: "Prepare for class", leadMinutes: 720, estMinutes: 45 });
    expect(materializePrepTasks(db, NOW)).toBe(2);
    expect(materializePrepTasks(db, NOW)).toBe(0);
    const tasks = listTasks(db);
    expect(tasks.map((t) => [t.type, t.source, t.estMinutes, t.courseId])).toEqual([
      ["prep", "rule", 45, course.id],
      ["prep", "rule", 45, course.id],
    ]);
    expect(tasks[0].dueAt).toBe(Date.parse("2026-10-12T12:50:00Z"));
  });

  it("does not bring back a prep task the owner deleted", () => {
    const { db, course } = setup();
    createRule(db, { courseId: course.id, title: "Prep", leadMinutes: 60 });
    materializePrepTasks(db, NOW);
    const [first] = listTasks(db);
    deleteTask(db, first.id, NOW);
    expect(materializePrepTasks(db, NOW)).toBe(0);
    expect(listTasks(db)).toHaveLength(1);
  });

  it("does nothing without active rules", () => {
    const { db } = setup();
    expect(materializePrepTasks(db, NOW)).toBe(0);
  });

  it("keeps finished prep tasks but removes upcoming ones when a rule is deleted", () => {
    const { db, course } = setup();
    const rule = createRule(db, { courseId: course.id, title: "Prep", leadMinutes: 60 });
    materializePrepTasks(db, NOW);
    const [first] = listTasks(db);
    setTaskStatus(db, first.id, "done", NOW);
    deleteRule(db, rule.id);
    materializePrepTasks(db, NOW);
    expect(listRules(db)).toEqual([]);
    expect(listTasks(db, { includeDone: true }).map((t) => t.status)).toEqual(["done"]);
  });

  it("does not double prep tasks when a routine is deleted and added again", () => {
    const { db, course } = setup();
    const rule = createRule(db, { courseId: course.id, title: "Prep", leadMinutes: 60 });
    materializePrepTasks(db, NOW);
    deleteRule(db, rule.id);
    createRule(db, { courseId: course.id, title: "Prep", leadMinutes: 60 });
    materializePrepTasks(db, NOW);
    expect(listTasks(db)).toHaveLength(2);
  });

  it("removes upcoming prep tasks for a class time that was removed", () => {
    const { db, course } = setup();
    createRule(db, { courseId: course.id, title: "Prep", leadMinutes: 60 });
    materializePrepTasks(db, NOW);
    for (const m of listMeetingTimes(db, course.id)) deleteMeetingTime(db, m.id);
    materializePrepTasks(db, NOW);
    expect(listTasks(db)).toEqual([]);
  });

  it("clears a prep task once its class has started, so it never turns overdue", () => {
    const { db, course } = setup();
    createRule(db, { courseId: course.id, title: "Prep", leadMinutes: 60 });
    materializePrepTasks(db, NOW);
    const afterFirstClass = Date.parse("2026-10-13T01:00:00Z"); // Tue 13 Oct 9:00, class began 8:50
    materializePrepTasks(db, afterFirstClass);
    expect(listTasks(db).map((t) => t.title)).toEqual(["Prep · Tue 20 Oct", "Prep · Tue 27 Oct"]);
  });
});

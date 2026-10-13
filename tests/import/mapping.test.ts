import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tronclassSnapshotSchema, yjsySnapshotSchema } from "@/import/schemas";
import { NOT_ON_TODO_NOTE, classNoFromCode, mapTronclass } from "@/import/tronclass";
import { mapYjsy, parseWeeks } from "@/import/yjsy";

const NOW = Date.parse("2026-10-12T04:00:00Z");
const load = (name: string) => JSON.parse(readFileSync(`sample-data/${name}`, "utf8")) as unknown;
const tronclass = () => tronclassSnapshotSchema.parse(load("courses-zju-sample.json"));
const yjsy = () => yjsySnapshotSchema.parse(load("timetable-yjsy-sample.json"));

describe("classNoFromCode", () => {
  it("takes the last all-digit segment of a course code", () => {
    expect(classNoFromCode("2026-13-9000001001")).toBe("9000001001");
    expect(classNoFromCode("9000003001")).toBe("9000003001");
    expect(classNoFromCode("ABC-1x")).toBeNull();
    expect(classNoFromCode(null)).toBeNull();
  });
});

describe("mapTronclass", () => {
  it("maps courses with their class numbers and instructors", () => {
    const { courses } = mapTronclass(tronclass(), NOW);
    expect(courses).toEqual([
      { externalId: "tc:course:900001", title: "Demo Strategy", code: "2026-13-9000001001", instructor: "Dr. Demo", semester: "2026-2027 Autumn", classNo: "9000001001" },
      {
        externalId: "tc:course:900002",
        title: "Demo Chinese",
        code: "2026-16-9000002007",
        instructor: "Ms. Sample, Mr. Example",
        semester: "2026-2027 Autumn-Winter",
        classNo: "9000002007",
      },
    ]);
  });

  it("imports homework, forums with deadlines and exams, and skips finished past work", () => {
    const { tasks, skippedPast } = mapTronclass(tronclass(), NOW);
    expect(tasks).toEqual([
      { externalId: "tc:activity:910001", courseExternalId: "tc:course:900001", type: "assignment", title: "Essay 1", dueAt: Date.parse("2026-10-20T15:59:00Z"), notes: null },
      {
        externalId: "tc:activity:910004",
        courseExternalId: "tc:course:900001",
        type: "assignment",
        title: "Forum: Discussion week 5",
        dueAt: Date.parse("2026-10-14T05:00:00Z"),
        notes: NOT_ON_TODO_NOTE,
      },
      { externalId: "tc:exam:920001", courseExternalId: "tc:course:900001", type: "exam", title: "Quiz 1", dueAt: Date.parse("2026-10-15T14:00:00Z"), notes: null },
      { externalId: "tc:activity:910010", courseExternalId: "tc:course:900002", type: "assignment", title: "Characters L2", dueAt: Date.parse("2026-10-14T04:00:00Z"), notes: null },
    ]);
    expect(skippedPast).toBe(1);
  });

  it("keeps past items that are still on the ZJU to-do list", () => {
    const later = Date.parse("2026-10-16T00:00:00Z");
    const { tasks } = mapTronclass(tronclass(), later);
    expect(tasks.map((t) => t.title)).toContain("Quiz 1");
    expect(tasks.map((t) => t.title)).not.toContain("Forum: Discussion week 5");
  });
});

describe("mapYjsy", () => {
  it("parses week lists", () => {
    expect(parseWeeks("1,3,5,7")).toEqual([1, 3, 5, 7]);
    expect(parseWeeks("3，1, 3 2")).toEqual([1, 2, 3]);
    expect(parseWeeks("")).toEqual([]);
  });

  it("builds the term with clock times for each period", () => {
    const { term } = mapYjsy(yjsy());
    expect(term).toMatchObject({ id: "yjsy:2026-12", name: "2026–2027", startDate: "2026-09-14", weeks: 18 });
    expect(term.periods[1]).toEqual({ period: 2, startMinute: 530, endMinute: 575 });
  });

  it("turns timetable rows into class times and skips rows with unknown periods", () => {
    const { meetings, skipped } = mapYjsy(yjsy());
    expect(meetings).toEqual([
      { externalId: "yjsy:9000001001:2:2-5:1.3.5.7", classNo: "9000001001", courseTitle: "Demo Strategy", teacher: "Dr. Demo", weekday: 2, startMinute: 530, endMinute: 745, room: "Demo Hall 101", weeks: [1, 3, 5, 7] },
      {
        externalId: "yjsy:9000002007:3:3-5:1.2.3.4.5.6.7.8.9.10.11.12.13.14.15.16",
        classNo: "9000002007",
        courseTitle: "Demo Chinese",
        teacher: "Ms. Sample",
        weekday: 3,
        startMinute: 600,
        endMinute: 745,
        room: "Demo Hall 202",
        weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
      },
      { externalId: "yjsy:9000003001:4:6-8:1.2.3", classNo: "9000003001", courseTitle: "Demo Seminar", teacher: "Prof. Placeholder", weekday: 4, startMinute: 805, endMinute: 950, room: "Demo Building", weeks: [1, 2, 3] },
    ]);
    expect(skipped).toBe(1);
  });

  it("keeps courses that have no weekly slot, with their room note", () => {
    expect(mapYjsy(yjsy()).noticeCourses).toEqual([
      { classNo: "9000004001", title: "Demo Workshop", teacher: "Visiting expert", note: "Room C1 (23 Oct in B2)" },
    ]);
  });
});

describe("schemas", () => {
  it("rejects a snapshot with the wrong shape", () => {
    expect(tronclassSnapshotSchema.safeParse({ courses: "nope" }).success).toBe(false);
    expect(yjsySnapshotSchema.safeParse({ calendar: {} }).success).toBe(false);
  });
});

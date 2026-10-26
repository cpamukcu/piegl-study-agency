import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listCourses } from "@/db/courses";
import { listTasks } from "@/db/tasks";
import { importSnapshots } from "@/import/run";
import { SyncError } from "@/sync/errors";
import { buildPlist } from "@/sync/launchd";
import { isDue, readStatus, writeStatus } from "@/sync/status";
import { fetchTronclassSnapshot } from "@/sync/tronclass";
import { buildYjsySnapshot, toIsoDate } from "@/sync/yjsy";
import { memoryDb } from "../helpers/db";

const NOW = Date.parse("2026-10-26T04:00:00Z");

const routes: Record<string, unknown> = {
  "/api/my-courses?page=1&page_size=100": {
    courses: [
      {
        id: 900001,
        name: "Demo Strategy",
        course_code: "2026-13-9000001001",
        instructors: [{ name: "Dr. Demo" }],
        semester: { name: "2026-2027 Autumn" },
        academic_year: { name: "2026-2027" },
        department: { name: "Demo School" },
        start_date: "2026-09-14",
        end_date: null,
        credit: 2,
      },
      { id: 900099, name: "Old course", course_code: null, end_date: "2025-01-10", instructors: [] },
    ],
  },
  "/api/todos?no-intercept=true": {
    todo_list: [{ id: 910001, type: "homework", title: "Essay 1", course_id: 900001, course_name: "Demo Strategy", end_time: "2026-11-02T15:59:00Z" }],
  },
  "/api/courses/900001/activities": {
    activities: [
      { id: 910001, type: "homework", title: "Essay 1", end_time: "2026-11-02T15:59:00Z", is_closed: false, published: true, module_id: 1, uploads: [] },
      { id: 910003, type: "material", title: "Lecture 1", uploads: [{ id: 5, name: "slides.pdf", size: 10, type: "pdf" }] },
    ],
  },
  "/api/courses/900001/exams": { exams: [{ id: 920001, type: "quiz", title: "Quiz 1", end_time: "2026-11-05T14:00:00Z", is_closed: false }] },
};

describe("Courses@ZJU fetch", () => {
  it("builds a valid snapshot and skips detail requests for long-ended courses", async () => {
    const asked: string[] = [];
    const snapshot = await fetchTronclassSnapshot(async (p) => {
      asked.push(p);
      if (!(p in routes)) throw new Error(`unexpected ${p}`);
      return routes[p];
    }, NOW);
    expect(snapshot.courses.map((c) => c.name)).toEqual(["Demo Strategy", "Old course"]);
    expect(snapshot.courses[0]).toMatchObject({ code: "2026-13-9000001001", instructors: ["Dr. Demo"], semester: "2026-2027 Autumn" });
    expect(snapshot.courses[0].activities).toHaveLength(2);
    expect(snapshot.courses[0].exams[0].id).toBe(920001);
    expect(snapshot.courses[1].activities).toEqual([]);
    expect(asked.some((p) => p.includes("900099"))).toBe(false);
  });

  it("refuses to save when ZJU lists no courses", async () => {
    await expect(fetchTronclassSnapshot(async () => ({ courses: [] }), NOW)).rejects.toBeInstanceOf(SyncError);
  });
});

const calendar = {
  data: {
    kssj: "2026-09-14",
    jssj: "2027-01-15",
    zcs: 18,
    pkzcs: 16,
    kszs: 2,
    sysJxrlSjdList: [
      { jc: 1, kssj: 800, jssj: 845 },
      { jc: 2, kssj: 850, jssj: 935 },
      { jc: 3, kssj: 1000, jssj: 1045 },
    ],
  },
};
const entry = { kcmc: "示例课程", bjbh: "9000001001", xm: "示例老师", xqj: 2, ksjc: 1, jsjc: 3, zc: "1,2,3", pkxqMc: "秋", xqmc: "紫金港", jxl: "东1", cdmc: "东1-101" };
const timetable = {
  data: {
    kcbMap: { "2": { "1": { pyKcbjSjddVOList: [entry] }, "2": { pyKcbjSjddVOList: [entry] } } },
    sjddList: [{ kcmc: "无固定时间", bjbh: "9000002001", kkxyMc: "学院", zjjsXm: "老师", bz: "Room TBD", xkzt: "已选" }],
  },
};

describe("graduate timetable build", () => {
  it("dedupes repeated period entries and keeps notices", () => {
    const snap = buildYjsySnapshot(calendar, timetable, { year: "2026", termCode: "12" }, NOW);
    expect(snap.classes).toHaveLength(1);
    expect(snap.classes[0]).toMatchObject({ class_no: "9000001001", weekday: 2, start_period: 1, end_period: 3, room: "东1-101" });
    expect(snap.notices[0]).toMatchObject({ class_no: "9000002001", note: "Room TBD" });
    expect(snap.calendar).toMatchObject({ start: "2026-09-14", weeks: 18, teaching_weeks: 16 });
  });

  it("reads the live `result` envelope", () => {
    const live = (body: unknown) => ({ success: true, code: 200, result: body, timestamp: 1 });
    const snap = buildYjsySnapshot(live(calendar.data), live(timetable.data), { year: "2026", termCode: "12" }, NOW);
    expect(snap.calendar.start).toBe("2026-09-14");
    expect(snap.classes).toHaveLength(1);
  });

  it("fails loudly on an empty timetable or a calendar it cannot read", () => {
    expect(() => buildYjsySnapshot(calendar, { data: { kcbMap: {}, sjddList: [] } }, { year: "2026", termCode: "12" }, NOW)).toThrow(SyncError);
    expect(() => buildYjsySnapshot({ data: {} }, timetable, { year: "2026", termCode: "12" }, NOW)).toThrow(SyncError);
  });

  it("reads dates in several formats", () => {
    expect(toIsoDate("2026-09-14 00:00:00")).toBe("2026-09-14");
    expect(toIsoDate("20260914")).toBe("2026-09-14");
    expect(toIsoDate(Date.parse("2026-09-13T16:00:00Z"))).toBe("2026-09-14");
    expect(toIsoDate("soon")).toBeNull();
  });
});

describe("fetched snapshots import cleanly", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "psa-sync-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("round-trips through the existing importer", async () => {
    const tronclass = await fetchTronclassSnapshot(async (p) => routes[p], NOW);
    const yjsy = buildYjsySnapshot(calendar, timetable, { year: "2026", termCode: "12" }, NOW);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "courses-zju-2026-10-26.json"), JSON.stringify(tronclass));
    writeFileSync(path.join(dir, "timetable-yjsy-2026-10-26.json"), JSON.stringify(yjsy));
    const db = memoryDb();
    const summary = importSnapshots(db, dir, NOW);
    expect(summary.meetings).toBe(1);
    expect(listTasks(db).map((t) => t.title)).toContain("Essay 1");
    expect(listCourses(db).length).toBeGreaterThanOrEqual(2);
  });
});

describe("sync schedule", () => {
  const DAY = 86_400_000;
  const ok = (at: number) => ({ state: "ok" as const, lastAttemptAt: at, lastSuccessAt: at, message: "" });

  it("is due when never synced or the last good sync is 3 days old", () => {
    expect(isDue(null, NOW, 3)).toBe(true);
    expect(isDue(ok(NOW - 1 * DAY), NOW, 3)).toBe(false);
    expect(isDue(ok(NOW - 3 * DAY), NOW, 3)).toBe(true);
  });

  it("a failed attempt does not reset the clock", () => {
    const failed = { state: "needs-login" as const, lastAttemptAt: NOW - 1000, lastSuccessAt: NOW - 4 * DAY, message: "" };
    expect(isDue(failed, NOW, 3)).toBe(true);
  });

  it("stores status privately and reads it back", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "psa-status-"));
    try {
      expect(readStatus(dir)).toBeNull();
      writeStatus(dir, ok(NOW));
      expect(readStatus(dir)).toMatchObject({ state: "ok", lastSuccessAt: NOW });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes a launchd plist that runs the sync every morning", () => {
    const plist = buildPlist({ nodePath: "/usr/local/bin/node", repoRoot: "/Users/me/PIEGL/study-agency", dataDir: "/Users/me/PIEGL-data", logFile: "/Users/me/PIEGL-data/logs/sync.log" });
    expect(plist).toContain("<string>/Users/me/PIEGL/study-agency/src/sync/cli.ts</string>");
    expect(plist).toContain("<key>Hour</key><integer>8</integer>");
    expect(plist).toContain("<key>DATA_DIR</key><string>/Users/me/PIEGL-data</string>");
  });
});

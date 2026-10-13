import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ImportError } from "@/import/run";
import {
  COURSE_NAMES_FILE,
  loadCourseNames,
  translateNote,
  translatePerson,
  translatePlace,
  translateSemester,
} from "@/import/translate";

describe("translateSemester", () => {
  it("names the seasons in English", () => {
    expect(translateSemester("2026-2027秋")).toBe("2026–2027 Autumn");
    expect(translateSemester("2026-2027秋冬")).toBe("2026–2027 Autumn–Winter");
    expect(translateSemester("2026-2027 Autumn")).toBe("2026–2027 Autumn");
    expect(translateSemester(null)).toBeNull();
  });
});

describe("translatePlace", () => {
  it("translates campus, direction, building and numbers", () => {
    expect(translatePlace("紫金港西2-103")).toBe("Zijingang West 2-103");
    expect(translatePlace("紫金港北4-410")).toBe("Zijingang North 4-410");
    expect(translatePlace("西二教学楼")).toBe("West 2 Teaching Building");
    expect(translatePlace("Demo Hall 101")).toBe("Demo Hall 101");
    expect(translatePlace(null)).toBeNull();
  });
});

describe("translateNote", () => {
  it("translates room-change notes", () => {
    expect(translateNote("管理学院C110（10月23日在B211）2026级PIEGL")).toBe("School of Management C110 (23 Oct in B211) 2026 PIEGL cohort");
    expect(translateNote("管理学院A202 2026级PIEGL")).toBe("School of Management A202 2026 PIEGL cohort");
    expect(translateNote("Room C1 (23 Oct in B2)")).toBe("Room C1 (23 Oct in B2)");
  });
});

describe("translatePerson", () => {
  it("translates role labels but leaves people's names alone", () => {
    expect(translatePerson("外聘专家")).toBe("Visiting expert");
    expect(translatePerson("张三")).toBe("张三");
    expect(translatePerson(null)).toBeNull();
  });
});

describe("loadCourseNames", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("reads the owner's names file, or nothing when there is none", () => {
    dir = mkdtempSync(path.join(tmpdir(), "psa-names-"));
    expect(loadCourseNames(dir)).toEqual({});
    writeFileSync(path.join(dir, COURSE_NAMES_FILE), JSON.stringify({ 演示课程: "Demo Course" }));
    expect(loadCourseNames(dir)).toEqual({ 演示课程: "Demo Course" });
  });

  it("refuses a names file with the wrong shape", () => {
    dir = mkdtempSync(path.join(tmpdir(), "psa-names-"));
    writeFileSync(path.join(dir, COURSE_NAMES_FILE), JSON.stringify({ a: 1 }));
    expect(() => loadCourseNames(dir as string)).toThrow(ImportError);
  });
});

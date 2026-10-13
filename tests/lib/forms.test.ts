import { describe, expect, it } from "vitest";
import { parseCourseForm, parseMeetingForm, parseRuleForm, parseTaskForm } from "@/lib/forms";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

const task = (overrides: Record<string, string> = {}) =>
  form({ title: "Essay", type: "assignment", courseId: "", due: "", estMinutes: "", importance: "2", notes: "", ...overrides });

describe("parseTaskForm", () => {
  it("accepts a full task and converts the due time from Shanghai", () => {
    expect(parseTaskForm(task({ courseId: "c1", due: "2026-10-19T23:59", estMinutes: "90", importance: "3", notes: " outline " }))).toEqual({
      ok: true,
      value: {
        title: "Essay",
        type: "assignment",
        courseId: "c1",
        dueAt: Date.parse("2026-10-19T15:59:00Z"),
        estMinutes: 90,
        importance: 3,
        notes: "outline",
      },
    });
  });

  it("turns empty optional fields into null", () => {
    expect(parseTaskForm(task())).toEqual({
      ok: true,
      value: { title: "Essay", type: "assignment", courseId: null, dueAt: null, estMinutes: null, importance: 2, notes: null },
    });
  });

  it("explains each bad field", () => {
    const result = parseTaskForm(task({ title: "  ", type: "party", due: "2026-02-30T10:00", estMinutes: "-5", importance: "9" }));
    expect(result).toEqual({
      ok: false,
      errors: {
        title: "Give the task a title.",
        type: "Pick a task type.",
        due: "Use a real date and time.",
        estMinutes: "Estimated minutes must be a whole number from 1 to 6000.",
        importance: "Pick an importance.",
      },
    });
  });
});

describe("parseCourseForm", () => {
  const course = (overrides: Record<string, string> = {}) =>
    form({ title: "Demo", code: "", instructor: "", semester: "", color: "#2f5d62", links: "", notes: "", ...overrides });

  it("accepts links one per line", () => {
    const result = parseCourseForm(course({ links: "https://a.example\n\n  http://b.example/x  " }));
    expect(result).toMatchObject({ ok: true, value: { title: "Demo", links: ["https://a.example", "http://b.example/x"], color: "#2f5d62" } });
  });

  it("rejects a missing title, a bad color and a non-web link", () => {
    expect(parseCourseForm(course({ title: "", color: "red", links: "ftp://x" }))).toEqual({
      ok: false,
      errors: { title: "Give the course a title.", color: "Pick a color.", links: "Not a web link: ftp://x" },
    });
  });
});

describe("parseMeetingForm", () => {
  const meeting = (overrides: Record<string, string> = {}) =>
    form({ courseId: "c1", weekday: "2", start: "08:50", end: "12:25", room: "", ...overrides });

  it("accepts a class time", () => {
    expect(parseMeetingForm(meeting({ room: "Hall 1" }))).toEqual({
      ok: true,
      value: { courseId: "c1", weekday: 2, startMinute: 530, endMinute: 745, room: "Hall 1" },
    });
  });

  it("rejects an end before the start and a bad weekday", () => {
    expect(parseMeetingForm(meeting({ weekday: "8", start: "12:00", end: "11:00" }))).toEqual({
      ok: false,
      errors: { weekday: "Pick a day.", end: "End must be after start." },
    });
    expect(parseMeetingForm(meeting({ start: "noon" }))).toEqual({ ok: false, errors: { start: "Use a time like 08:50." } });
  });
});

describe("parseRuleForm", () => {
  const rule = (overrides: Record<string, string> = {}) =>
    form({ courseId: "c1", title: "", leadHours: "12", estMinutes: "45", importance: "2", ...overrides });

  it("defaults the title and converts hours to minutes", () => {
    expect(parseRuleForm(rule({ leadHours: "1.5" }))).toEqual({
      ok: true,
      value: { courseId: "c1", title: "Prepare for class", leadMinutes: 90, estMinutes: 45, importance: 2 },
    });
  });

  it("rejects a negative lead time", () => {
    expect(parseRuleForm(rule({ leadHours: "-1" }))).toEqual({
      ok: false,
      errors: { leadHours: "Use a number of hours from 0 to 168." },
    });
  });
});

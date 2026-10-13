import { z } from "zod";
import type { CourseInput } from "@/db/courses";
import type { MeetingInput } from "@/db/meetings";
import type { RuleInput } from "@/db/rules";
import { TASK_TYPES, type Importance, type TaskInput } from "@/db/tasks";
import { parseClock, parseLocalDateTime } from "@/lib/time";

export type FormResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

function read(fd: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, String(fd.get(key) ?? "")]));
}

function toErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

const optionalInt = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number from ${min} to ${max}.` });
        return z.NEVER;
      }
      return n;
    });

const importance = z.enum(["1", "2", "3"], { error: "Pick an importance." }).transform((v) => Number(v) as Importance);

const taskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(200, "Keep the title under 200 characters."),
  type: z.enum(TASK_TYPES, { error: "Pick a task type." }),
  courseId: optionalText(64),
  due: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const ms = parseLocalDateTime(v);
      if (ms === null) {
        ctx.addIssue({ code: "custom", message: "Use a real date and time." });
        return z.NEVER;
      }
      return ms;
    }),
  estMinutes: optionalInt(1, 6000, "Estimated minutes"),
  importance,
  notes: optionalText(2000),
});

export function parseTaskForm(fd: FormData): FormResult<TaskInput> {
  const r = taskSchema.safeParse(read(fd, ["title", "type", "courseId", "due", "estMinutes", "importance", "notes"]));
  if (!r.success) return { ok: false, errors: toErrors(r.error) };
  const d = r.data;
  return {
    ok: true,
    value: { title: d.title, type: d.type, courseId: d.courseId, dueAt: d.due, estMinutes: d.estMinutes, importance: d.importance, notes: d.notes },
  };
}

const courseSchema = z.object({
  title: z.string().trim().min(1, "Give the course a title.").max(120, "Keep the title under 120 characters."),
  code: optionalText(60),
  instructor: optionalText(200),
  semester: optionalText(60),
  color: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return undefined;
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "Pick a color." });
        return z.NEVER;
      }
      return v.toLowerCase();
    }),
  links: z.string().transform((v, ctx) => {
    const lines = v
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const bad = lines.find((line) => !/^https?:\/\/\S+$/i.test(line));
    if (bad) {
      ctx.addIssue({ code: "custom", message: `Not a web link: ${bad}` });
      return z.NEVER;
    }
    return lines;
  }),
  notes: optionalText(2000),
});

export function parseCourseForm(fd: FormData): FormResult<CourseInput> {
  const r = courseSchema.safeParse(read(fd, ["title", "code", "instructor", "semester", "color", "links", "notes"]));
  if (!r.success) return { ok: false, errors: toErrors(r.error) };
  return { ok: true, value: r.data };
}

const clock = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const minutes = parseClock(v);
    if (minutes === null) {
      ctx.addIssue({ code: "custom", message: "Use a time like 08:50." });
      return z.NEVER;
    }
    return minutes;
  });

const meetingFields = z.object({
  courseId: z.string().trim().min(1, "Pick a course."),
  weekday: z.enum(["1", "2", "3", "4", "5", "6", "7"], { error: "Pick a day." }).transform(Number),
  start: clock,
  end: clock,
  room: optionalText(80),
});

// The start/end comparison runs outside Zod so it is reported even when another field fails.
export function parseMeetingForm(fd: FormData): FormResult<MeetingInput> {
  const raw = read(fd, ["courseId", "weekday", "start", "end", "room"]);
  const r = meetingFields.safeParse(raw);
  const errors: Record<string, string> = r.success ? {} : toErrors(r.error);
  const start = parseClock(raw.start);
  const end = parseClock(raw.end);
  if (start !== null && end !== null && end <= start) errors.end ??= "End must be after start.";
  if (!r.success || Object.keys(errors).length) return { ok: false, errors };
  const d = r.data;
  return { ok: true, value: { courseId: d.courseId, weekday: d.weekday, startMinute: d.start, endMinute: d.end, room: d.room } };
}

const ruleSchema = z.object({
  courseId: z.string().trim().min(1, "Pick a course."),
  title: z
    .string()
    .trim()
    .max(120, "Keep the title under 120 characters.")
    .transform((v) => v || "Prepare for class"),
  leadHours: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const hours = Number(v);
      if (v === "" || !Number.isFinite(hours) || hours < 0 || hours > 168) {
        ctx.addIssue({ code: "custom", message: "Use a number of hours from 0 to 168." });
        return z.NEVER;
      }
      return Math.round(hours * 60);
    }),
  estMinutes: optionalInt(1, 600, "Estimated minutes"),
  importance,
});

export function parseRuleForm(fd: FormData): FormResult<RuleInput> {
  const r = ruleSchema.safeParse(read(fd, ["courseId", "title", "leadHours", "estMinutes", "importance"]));
  if (!r.success) return { ok: false, errors: toErrors(r.error) };
  const d = r.data;
  return { ok: true, value: { courseId: d.courseId, title: d.title, leadMinutes: d.leadHours, estMinutes: d.estMinutes, importance: d.importance } };
}

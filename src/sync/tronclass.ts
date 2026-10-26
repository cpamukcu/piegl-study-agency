// Builds a Courses@ZJU snapshot from read-only GET requests. The caller supplies `getJson`, which
// performs the request with the owner's logged-in browser session, so this file stays testable.
import { SyncError } from "@/sync/errors";
import { tronclassSnapshotSchema, type TronclassSnapshot } from "@/import/schemas";
import { DAY_MS } from "@/lib/time";

export type GetJson = (path: string) => Promise<unknown>;

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
// Courses that ended long ago have nothing left to track, so skip their detail requests.
const STALE_AFTER_MS = 14 * DAY_MS;

type Obj = Record<string, unknown>;

const obj = (value: unknown): Obj => (value && typeof value === "object" ? (value as Obj) : {});
const list = (value: unknown): Obj[] => (Array.isArray(value) ? value.map(obj) : []);
const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const bool = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);
const nameOf = (value: unknown): string | null => text(obj(value).name);

function requireNumber(value: unknown, what: string): number {
  const n = num(value);
  if (n === null) throw new SyncError(`Courses@ZJU sent a ${what} without a numeric id. ZJU may have changed its format.`);
  return n;
}

function mapActivity(a: Obj) {
  return {
    id: requireNumber(a.id, "activity"),
    type: text(a.type) ?? "unknown",
    title: text(a.title) ?? "(untitled)",
    start_time: text(a.start_time),
    end_time: text(a.end_time),
    is_closed: bool(a.is_closed),
    published: bool(a.published),
    module_id: num(a.module_id),
    uploads: list(a.uploads).map((u) => ({
      id: requireNumber(u.id, "upload"),
      name: text(u.name) ?? "(unnamed)",
      size: num(u.size),
      type: text(u.type),
    })),
  };
}

function mapExam(e: Obj) {
  return {
    id: requireNumber(e.id, "exam"),
    type: text(e.type) ?? "unknown",
    title: text(e.title) ?? "(untitled)",
    start_time: text(e.start_time),
    end_time: text(e.end_time),
    is_closed: bool(e.is_closed),
  };
}

export async function fetchTronclassSnapshot(getJson: GetJson, now: number): Promise<TronclassSnapshot> {
  const rawCourses: Obj[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = list(obj(await getJson(`/api/my-courses?page=${page}&page_size=${PAGE_SIZE}`)).courses);
    rawCourses.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  if (rawCourses.length === 0) {
    throw new SyncError("Courses@ZJU listed no courses. Nothing was saved, so your existing data stays as it is.");
  }

  const todos = list(obj(await getJson("/api/todos?no-intercept=true")).todo_list).map((t) => ({
    id: requireNumber(t.id, "to-do"),
    type: text(t.type) ?? "unknown",
    title: text(t.title) ?? "(untitled)",
    course_id: requireNumber(t.course_id, "to-do"),
    course_name: text(t.course_name) ?? "",
    end_time: text(t.end_time),
  }));

  const courses: TronclassSnapshot["courses"] = [];
  for (const c of rawCourses) {
    const id = requireNumber(c.id, "course");
    const end = text(c.end_date);
    const ended = end !== null && Date.parse(end) < now - STALE_AFTER_MS;
    const hasTodo = todos.some((t) => t.course_id === id);
    const [activities, exams] =
      ended && !hasTodo
        ? [[], []]
        : [
            list(obj(await getJson(`/api/courses/${id}/activities`)).activities).map(mapActivity),
            list(obj(await getJson(`/api/courses/${id}/exams`)).exams).map(mapExam),
          ];
    courses.push({
      id,
      name: text(c.name) ?? "(untitled)",
      code: text(c.course_code),
      credit: num(c.credit),
      department: nameOf(c.department),
      semester: nameOf(c.semester),
      academic_year: nameOf(c.academic_year),
      start_date: text(c.start_date),
      end_date: end,
      instructors: list(c.instructors).flatMap((i) => text(i.name) ?? []),
      activities,
      exams,
    });
  }

  return tronclassSnapshotSchema.parse({
    source: "courses.zju.edu.cn (TronClass)",
    fetched_at: new Date(now).toISOString(),
    todos,
    courses,
  });
}

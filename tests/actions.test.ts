import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/cache", () => ({ refresh }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

import {
  addMeetingAction,
  createCourseAction,
  createRuleAction,
  createTaskAction,
  deleteCourseAction,
  importSnapshotsAction,
  setTaskStatusAction,
  updateCourseAction,
  updateTaskAction,
} from "@/app/actions";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { getTask, listTasks } from "@/db/tasks";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "psa-actions-"));
  vi.stubEnv("DATA_DIR", dir);
  refresh.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("task actions", () => {
  it("saves a valid task and refreshes the page", async () => {
    const state = await createTaskAction(
      INITIAL_ACTION_STATE,
      form({ title: "Essay", type: "assignment", courseId: "", due: "", estMinutes: "", importance: "2", notes: "" }),
    );
    expect(state).toMatchObject({ ok: true, message: "Task added." });
    expect(listTasks(getDb()).map((t) => t.title)).toEqual(["Essay"]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("returns field errors and the typed values, and saves nothing", async () => {
    const state = await createTaskAction(
      INITIAL_ACTION_STATE,
      form({ title: "", type: "assignment", courseId: "", due: "", estMinutes: "", importance: "2", notes: "keep me" }),
    );
    expect(state).toMatchObject({ ok: false, errors: { title: "Give the task a title." }, values: { notes: "keep me" } });
    expect(listTasks(getDb())).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("marks a task done and ignores unknown statuses", async () => {
    await createTaskAction(INITIAL_ACTION_STATE, form({ title: "x", type: "reading", courseId: "", due: "", estMinutes: "", importance: "2", notes: "" }));
    const [task] = listTasks(getDb());
    await setTaskStatusAction(form({ id: task.id, status: "nonsense" }));
    expect(listTasks(getDb())).toHaveLength(1);
    await setTaskStatusAction(form({ id: task.id, status: "done" }));
    expect(listTasks(getDb())).toEqual([]);
  });
  it("updates a task's estimate and importance, keeping type and course", async () => {
    await createTaskAction(INITIAL_ACTION_STATE, form({ title: "Lab", type: "assignment", courseId: "", due: "", estMinutes: "", importance: "2", notes: "" }));
    const [task] = listTasks(getDb());
    const state = await updateTaskAction(
      INITIAL_ACTION_STATE,
      form({ id: task.id, title: "Lab 1", type: "assignment", courseId: "", due: "2026-10-19T23:59", estMinutes: "120", importance: "3", notes: "" }),
    );
    expect(state).toMatchObject({ ok: true, message: "Task saved." });
    expect(getTask(getDb(), task.id)).toMatchObject({ title: "Lab 1", estMinutes: 120, importance: 3, dueAt: Date.parse("2026-10-19T15:59:00Z") });
  });

  it("refuses an update with a bad field", async () => {
    await createTaskAction(INITIAL_ACTION_STATE, form({ title: "Lab", type: "assignment", courseId: "", due: "", estMinutes: "", importance: "2", notes: "" }));
    const [task] = listTasks(getDb());
    const state = await updateTaskAction(
      INITIAL_ACTION_STATE,
      form({ id: task.id, title: "Lab", type: "assignment", courseId: "", due: "", estMinutes: "-1", importance: "2", notes: "" }),
    );
    expect(state.ok).toBe(false);
    expect(getTask(getDb(), task.id)?.estMinutes).toBeNull();
  });
});

describe("course actions", () => {
  it("creates a course, then deletes it and goes back to the list", async () => {
    const state = await createCourseAction(
      INITIAL_ACTION_STATE,
      form({ title: "Demo", code: "", instructor: "", semester: "", color: "#2f5d62", links: "", notes: "" }),
    );
    expect(state.ok).toBe(true);
    const [course] = listCourses(getDb());
    await expect(deleteCourseAction(form({ id: course.id }))).rejects.toThrow("REDIRECT /courses");
    expect(listCourses(getDb())).toEqual([]);
  });
});

describe("stale forms", () => {
  const taskForm = (overrides: Record<string, string>) =>
    form({ title: "Essay", type: "assignment", courseId: "", due: "", estMinutes: "", importance: "2", notes: "", ...overrides });

  it("asks for another course when the chosen one was deleted", async () => {
    expect(await createTaskAction(INITIAL_ACTION_STATE, taskForm({ courseId: "gone" }))).toMatchObject({
      ok: false,
      errors: { courseId: "That course no longer exists. Pick another." },
    });
    expect(
      await addMeetingAction(INITIAL_ACTION_STATE, form({ courseId: "gone", weekday: "2", start: "08:50", end: "10:00", room: "" })),
    ).toMatchObject({ ok: false, errors: { courseId: "That course no longer exists. Pick another." } });
    expect(
      await createRuleAction(INITIAL_ACTION_STATE, form({ courseId: "gone", title: "", leadHours: "12", estMinutes: "45", importance: "2" })),
    ).toMatchObject({ ok: false, message: "That course no longer exists." });
    expect(listTasks(getDb())).toEqual([]);
  });

  it("says so when the task or course being edited no longer exists", async () => {
    expect(await updateTaskAction(INITIAL_ACTION_STATE, taskForm({ id: "gone" }))).toMatchObject({
      ok: false,
      message: "This task no longer exists.",
    });
    expect(
      await updateCourseAction(
        INITIAL_ACTION_STATE,
        form({ id: "gone", title: "Demo", code: "", instructor: "", semester: "", color: "#2f5d62", links: "", notes: "" }),
      ),
    ).toMatchObject({ ok: false, message: "This course no longer exists." });
  });
});

describe("importSnapshotsAction", () => {
  it("imports from DATA_DIR/snapshots and reports what it did", async () => {
    mkdirSync(path.join(dir, "snapshots"));
    copyFileSync("sample-data/courses-zju-sample.json", path.join(dir, "snapshots", "courses-zju-2026-10-12.json"));
    const state = await importSnapshotsAction(INITIAL_ACTION_STATE, new FormData());
    expect(state.ok).toBe(true);
    expect(state.message).toMatch(/^Added 2 courses/);
    expect(listCourses(getDb())).toHaveLength(2);
  });

  it("reports a broken snapshot instead of crashing", async () => {
    mkdirSync(path.join(dir, "snapshots"));
    copyFileSync("package.json", path.join(dir, "snapshots", "courses-zju-2026-10-12.json"));
    const state = await importSnapshotsAction(INITIAL_ACTION_STATE, new FormData());
    expect(state).toMatchObject({ ok: false });
    expect(state.message).toMatch(/unexpected format/);
  });
});

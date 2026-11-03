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
  addSourceAction,
  assessAnswerAction,
  createProjectAction,
  generateBriefAction,
  saveReviewAction,
  setCourseAiAction,
  createCourseAction,
  createRuleAction,
  createTaskAction,
  deleteCourseAction,
  importSnapshotsAction,
  setTaskStatusAction,
  updateCourseAction,
  updateTaskAction,
  uploadMaterialAction,
} from "@/app/actions";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { listMaterials } from "@/db/materials";
import { listProjects, listSources } from "@/db/research";
import { getReview } from "@/db/reviews";
import { listAttempts, listBriefs, listQuestions } from "@/db/study";
import { setProviderForTests } from "@/ai";
import { FakeProvider } from "./helpers/fake-ai";
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

describe("material actions", () => {
  it("uploads files to a course, reads them, and reports what could not be read", async () => {
    const { makePdf } = await import("./helpers/files");
    await createCourseAction(INITIAL_ACTION_STATE, form({ title: "Demo", code: "", instructor: "", semester: "", color: "#2f5d62", links: "", notes: "" }));
    const [course] = listCourses(getDb());
    const fd = form({ courseId: course.id });
    fd.append("file", new File([makePdf([["Hello"]]) as BlobPart], "Week 1.pdf", { type: "application/pdf" }));
    fd.append("file", new File([new Uint8Array([1, 2])], "old.ppt"));
    const state = await uploadMaterialAction(INITIAL_ACTION_STATE, fd);
    expect(state).toMatchObject({ ok: true });
    expect(state.message).toContain("2 files added.");
    expect(state.message).toContain("old.ppt is kept, but only PDF, PPTX and text files can be read.");
    expect(listMaterials(getDb(), course.id).map((m) => m.extraction).sort()).toEqual(["ok", "unsupported"]);
  });

  it("asks for a file, and refuses a missing course", async () => {
    await createCourseAction(INITIAL_ACTION_STATE, form({ title: "Demo", code: "", instructor: "", semester: "", color: "#2f5d62", links: "", notes: "" }));
    const [course] = listCourses(getDb());
    expect(await uploadMaterialAction(INITIAL_ACTION_STATE, form({ courseId: course.id }))).toMatchObject({ ok: false, errors: { file: "Choose a file to upload." } });
    expect(await uploadMaterialAction(INITIAL_ACTION_STATE, form({ courseId: "gone" }))).toMatchObject({ ok: false, message: "That course no longer exists." });
  });
});

describe("AI and study actions", () => {
  const brief = {
    overview: "x",
    key_points: [{ point: "p", refs: ["1:1"] }],
    concepts: [{ term: "MVP", definition: "d", refs: ["1:1"] }],
    ask_in_class: [],
    flashcards: [],
    practice_questions: [{ question: "Why test early?", kind: "explain", refs: ["1:1"] }],
  };
  const assess = { accuracy: 4, clarity: 3, evidence: 2, strengths: ["s"], missing: ["m"], outline: [{ point: "o", label: "fact", refs: ["1:1"] }], follow_up: "f" };

  async function courseWithFile() {
    const { makePdf } = await import("./helpers/files");
    await createCourseAction(INITIAL_ACTION_STATE, form({ title: "Demo", code: "", instructor: "", semester: "", color: "#2f5d62", links: "", notes: "" }));
    const [course] = listCourses(getDb());
    const fd = form({ courseId: course.id });
    fd.append("file", new File([makePdf([["Test early"]]) as BlobPart], "w.pdf"));
    await uploadMaterialAction(INITIAL_ACTION_STATE, fd);
    return { course, material: listMaterials(getDb(), course.id)[0] };
  }

  afterEach(() => setProviderForTests(undefined));

  it("makes a brief and opens it; says so when AI is off", async () => {
    const { course, material } = await courseWithFile();
    setProviderForTests(null);
    expect(await generateBriefAction(INITIAL_ACTION_STATE, form({ courseId: course.id, material: material.id }))).toMatchObject({
      ok: false,
      message: expect.stringContaining("AI is off"),
    });
    setProviderForTests(new FakeProvider({ brief }));
    await expect(generateBriefAction(INITIAL_ACTION_STATE, form({ courseId: course.id, material: material.id }))).rejects.toThrow(/REDIRECT \/prepare\/briefs\//);
    expect(listBriefs(getDb())).toHaveLength(1);
  });

  it("assesses an answer and keeps the draft when it cannot", async () => {
    const { course, material } = await courseWithFile();
    setProviderForTests(new FakeProvider({ brief, assess }));
    await generateBriefAction(INITIAL_ACTION_STATE, form({ courseId: course.id, material: material.id })).catch(() => {});
    const [question] = listQuestions(getDb());
    const short = await assessAnswerAction(INITIAL_ACTION_STATE, form({ id: question.id, answer: "short" }));
    expect(short).toMatchObject({ ok: false, values: { answer: "short" } });
    const ok = await assessAnswerAction(INITIAL_ACTION_STATE, form({ id: question.id, answer: "Because testing early saves time and money." }));
    expect(ok.ok).toBe(true);
    expect(listAttempts(getDb(), { questionId: question.id })[0].assessment.accuracy).toBe(4);
  });

  it("toggles AI for a course", async () => {
    await createCourseAction(INITIAL_ACTION_STATE, form({ title: "Demo", code: "", instructor: "", semester: "", color: "#2f5d62", links: "", notes: "" }));
    const [course] = listCourses(getDb());
    await setCourseAiAction(form({ id: course.id, aiAllowed: "0" }));
    expect(listCourses(getDb())[0].aiAllowed).toBe(false);
  });
});

describe("research and review actions", () => {
  it("checks a source's link, DOI or ISBN", async () => {
    await expect(createProjectAction(INITIAL_ACTION_STATE, form({ question: "How do visas shape founders?", courseId: "" }))).rejects.toThrow(/REDIRECT \/research\//);
    const [project] = listProjects(getDb());
    const add = (locator: string) => addSourceAction(INITIAL_ACTION_STATE, form({ projectId: project.id, title: "Paper", authors: "", year: "", locator, notes: "", relevance: "3" }));
    expect(await add("not a link")).toMatchObject({ ok: false, errors: { locator: expect.any(String) } });
    expect((await add("10.1000/xyz123")).ok).toBe(true);
    expect((await add("https://example.org/paper")).ok).toBe(true);
    expect((await add("ISBN 978-0-306-40615-7")).ok).toBe(true);
    expect(listSources(getDb(), project.id).every((s) => s.verifiedAt === null)).toBe(true);
  });

  it("saves a review only when the plan respects deadlines", async () => {
    await createTaskAction(INITIAL_ACTION_STATE, form({ title: "Essay", type: "assignment", courseId: "", due: "2026-11-11T23:59", estMinutes: "60", importance: "2", notes: "" }));
    const [task] = listTasks(getDb());
    const weekStart = String(Date.parse("2026-11-01T16:00:00Z")); // Monday 2 Nov, Shanghai
    const late = await saveReviewAction(INITIAL_ACTION_STATE, form({ weekStart, include: task.id, [`day-${task.id}`]: "4", wentWell: "a" }));
    expect(late).toMatchObject({ ok: false, message: "Essay is due before then. Plan it earlier.", values: { [`include:${task.id}`]: "1" } });
    expect((await saveReviewAction(INITIAL_ACTION_STATE, form({ weekStart, include: task.id, [`day-${task.id}`]: "2", wentWell: "a" }))).ok).toBe(true);
    expect(getReview(getDb(), Number(weekStart))).toMatchObject({ wentWell: "a", plan: [{ taskId: task.id, title: "Essay", day: 2 }] });
    expect(await saveReviewAction(INITIAL_ACTION_STATE, form({ weekStart: "123" }))).toMatchObject({ ok: false, message: "Unknown week." });
  });
});

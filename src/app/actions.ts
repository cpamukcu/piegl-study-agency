"use server";

import path from "node:path";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { assessAnswer } from "@/ai/assess";
import { generateBrief } from "@/ai/brief";
import { generatePlan } from "@/ai/research";
import { AiError, getProvider } from "@/ai";
import { getDb } from "@/db/connection";
import { createCourse, deleteCourse, getCourse, setCourseAi, updateCourse } from "@/db/courses";
import { MAX_MATERIAL_BYTES, addMaterial, deleteMaterial } from "@/db/materials";
import { addMeetingTime, deleteMeetingTime } from "@/db/meetings";
import {
  NOTE_LABELS,
  addNote,
  addSource,
  createProject,
  deleteNote,
  deleteProject,
  deleteSource,
  getProject,
  listSources,
  setSourceVerified,
  type NoteLabel,
} from "@/db/research";
import { saveReview } from "@/db/reviews";
import { createRule, deleteRule, materializePrepTasks } from "@/db/rules";
import {
  CONCEPT_STATUSES,
  QUESTION_KINDS,
  addQuestion,
  deleteBrief,
  deleteQuestion,
  getQuestion,
  setConceptStatus,
  type ConceptStatus,
  type QuestionKind,
} from "@/db/study";
import { TASK_STATUSES, createTask, deleteTask, getTask, listTasks, postponeTask, setTaskStatus, updateTask, type TaskStatus } from "@/db/tasks";
import { ImportError, describeImport, importSnapshots } from "@/import/run";
import { formValues, type ActionState } from "@/lib/action-state";
import { DataDirError, getDataDir } from "@/lib/data-dir";
import { parseCourseForm, parseMeetingForm, parseRuleForm, parseTaskForm, type FormResult } from "@/lib/forms";
import { checkPlan } from "@/lib/review";
import { DAY_MS, startOfShanghaiWeek } from "@/lib/time";

const idOf = (fd: FormData) => String(fd.get("id") ?? "");

function failed<T>(result: Extract<FormResult<T>, { ok: false }>, fd: FormData): ActionState {
  return { ok: false, errors: result.errors, values: formValues(fd), nonce: Date.now() };
}

// Forms can outlive their course (deleted in another tab); answer with a message, not a crash.
function courseGone(courseId: string | null | undefined): boolean {
  return Boolean(courseId) && !getCourse(getDb(), courseId as string);
}

function courseFieldGone(fd: FormData): ActionState {
  const message = "That course no longer exists. Pick another.";
  return { ok: false, message, errors: { courseId: message }, values: formValues(fd), nonce: Date.now() };
}

function done(message: string): ActionState {
  refresh();
  return { ok: true, message, nonce: Date.now() };
}

export async function createTaskAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseTaskForm(fd);
  if (!parsed.ok) return failed(parsed, fd);
  if (courseGone(parsed.value.courseId)) return courseFieldGone(fd);
  createTask(getDb(), parsed.value);
  return done("Task added.");
}

export async function updateTaskAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseTaskForm(fd);
  if (!parsed.ok) return failed(parsed, fd);
  const task = getTask(getDb(), idOf(fd));
  if (!task || task.deletedAt !== null) return { ok: false, message: "This task no longer exists.", nonce: Date.now() };
  if (courseGone(parsed.value.courseId)) return courseFieldGone(fd);
  updateTask(getDb(), task.id, parsed.value);
  return done("Task saved.");
}

export async function setTaskStatusAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  const status = String(fd.get("status") ?? "");
  if (!id || !(TASK_STATUSES as readonly string[]).includes(status)) return;
  setTaskStatus(getDb(), id, status as TaskStatus);
  refresh();
}

export async function postponeTaskAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (!id) return;
  postponeTask(getDb(), id, DAY_MS);
  refresh();
}

export async function deleteTaskAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (!id) return;
  deleteTask(getDb(), id);
  refresh();
}

export async function createCourseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseCourseForm(fd);
  if (!parsed.ok) return failed(parsed, fd);
  createCourse(getDb(), parsed.value);
  return done("Course added.");
}

export async function updateCourseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseCourseForm(fd);
  if (!parsed.ok) return failed(parsed, fd);
  if (!getCourse(getDb(), idOf(fd))) return { ok: false, message: "This course no longer exists.", nonce: Date.now() };
  updateCourse(getDb(), idOf(fd), parsed.value);
  return done("Course saved.");
}

export async function deleteCourseAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (id) deleteCourse(getDb(), id);
  redirect("/courses");
}

export async function addMeetingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseMeetingForm(fd);
  if (!parsed.ok) return failed(parsed, fd);
  if (courseGone(parsed.value.courseId)) return courseFieldGone(fd);
  addMeetingTime(getDb(), parsed.value);
  return done("Class time added.");
}

export async function deleteMeetingAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (!id) return;
  deleteMeetingTime(getDb(), id);
  refresh();
}

export async function createRuleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseRuleForm(fd);
  if (!parsed.ok) return failed(parsed, fd);
  if (courseGone(parsed.value.courseId)) return { ok: false, message: "That course no longer exists.", nonce: Date.now() };
  const db = getDb();
  createRule(db, parsed.value);
  const added = materializePrepTasks(db, Date.now());
  return done(added ? `Prep routine added. ${added} prep tasks created for the next two weeks.` : "Prep routine added.");
}

export async function deleteRuleAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (!id) return;
  deleteRule(getDb(), id);
  refresh();
}

// useActionState always passes (state, formData); this action needs neither.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function importSnapshotsAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  try {
    const summary = importSnapshots(getDb(), path.join(getDataDir(), "snapshots"));
    return done(describeImport(summary));
  } catch (error) {
    if (error instanceof ImportError || error instanceof DataDirError) {
      return { ok: false, message: error.message, nonce: Date.now() };
    }
    throw error;
  }
}

export async function uploadMaterialAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const courseId = String(fd.get("courseId") ?? "");
  const files = fd.getAll("file").filter((f): f is File => typeof f !== "string" && f.size > 0);
  if (courseGone(courseId) || !courseId) return { ok: false, message: "That course no longer exists.", nonce: Date.now() };
  if (files.length === 0) return { ok: false, errors: { file: "Choose a file to upload." }, nonce: Date.now() };
  const tooBig = files.find((f) => f.size > MAX_MATERIAL_BYTES);
  if (tooBig) return { ok: false, errors: { file: `${tooBig.name} is over 50 MB.` }, nonce: Date.now() };

  const db = getDb();
  const dataDir = getDataDir();
  const notes: string[] = [];
  for (const file of files) {
    const { material, duplicate } = await addMaterial(db, dataDir, { courseId, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    if (duplicate) notes.push(`${file.name} was already here.`);
    else if (material.extraction === "no-text") notes.push(`${file.name} has no text layer (scanned?), so it cannot be studied here yet.`);
    else if (material.extraction === "failed") notes.push(`${file.name} could not be read: ${material.extractionError}`);
    else if (material.extraction === "unsupported") notes.push(`${file.name} is kept, but only PDF, PPTX and text files can be read.`);
  }
  return done([`${files.length === 1 ? "File" : `${files.length} files`} added.`, ...notes].join(" "));
}

export async function deleteMaterialAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (id) deleteMaterial(getDb(), getDataDir(), id);
  refresh();
}

function aiFailed(error: unknown): ActionState {
  if (error instanceof AiError) return { ok: false, message: error.message, nonce: Date.now() };
  throw error;
}

export async function setCourseAiAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (!id) return;
  setCourseAi(getDb(), id, fd.get("aiAllowed") === "1");
  refresh();
}

export async function generateBriefAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const course = getCourse(getDb(), String(fd.get("courseId") ?? ""));
  if (!course) return { ok: false, message: "That course no longer exists.", nonce: Date.now() };
  const materialIds = fd.getAll("material").map(String);
  const at = Number(fd.get("classAt") ?? "");
  let briefId: string;
  try {
    briefId = (await generateBrief(getDb(), getProvider(), course, materialIds, Number.isFinite(at) && at > 0 ? at : null)).id;
  } catch (error) {
    return aiFailed(error);
  }
  redirect(`/prepare/briefs/${briefId}`);
}

export async function deleteBriefAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (id) deleteBrief(getDb(), id);
  redirect("/prepare");
}

export async function setConceptStatusAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  const status = String(fd.get("status") ?? "");
  if (!id || !(CONCEPT_STATUSES as readonly string[]).includes(status)) return;
  setConceptStatus(getDb(), id, status as ConceptStatus);
  refresh();
}

export async function addQuestionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const courseId = String(fd.get("courseId") ?? "");
  const question = String(fd.get("question") ?? "").trim();
  const kind = String(fd.get("kind") ?? "explain");
  if (!getCourse(getDb(), courseId)) return { ok: false, errors: { courseId: "Pick a course." }, values: formValues(fd), nonce: Date.now() };
  if (question.length < 5 || question.length > 1000) {
    return { ok: false, errors: { question: "Write a question of 5 to 1000 characters." }, values: formValues(fd), nonce: Date.now() };
  }
  if (!(QUESTION_KINDS as readonly string[]).includes(kind)) return { ok: false, errors: { kind: "Pick a kind." }, values: formValues(fd), nonce: Date.now() };
  addQuestion(getDb(), { courseId, question, kind: kind as QuestionKind });
  return done("Question added.");
}

export async function deleteQuestionAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (id) deleteQuestion(getDb(), id);
  redirect("/practice");
}

export async function assessAnswerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const db = getDb();
  const question = getQuestion(db, idOf(fd));
  if (!question) return { ok: false, message: "This question no longer exists.", nonce: Date.now() };
  const course = getCourse(db, question.courseId);
  if (!course) return { ok: false, message: "This question's course no longer exists.", nonce: Date.now() };
  try {
    await assessAnswer(db, getProvider(), course, question, String(fd.get("answer") ?? ""));
  } catch (error) {
    const failed = aiFailed(error);
    return { ...failed, values: formValues(fd) };
  }
  return done("Assessed. Read the feedback below, then try again or move on.");
}

const RELEVANCE = { "1": 1, "2": 2, "3": 3 } as const;
const text = (fd: FormData, key: string, max: number) => {
  const v = String(fd.get(key) ?? "").trim();
  return v ? v.slice(0, max) : null;
};

export async function createProjectAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const question = text(fd, "question", 1000);
  const courseId = text(fd, "courseId", 64);
  if (!question || question.length < 10) {
    return { ok: false, errors: { question: "Write your research question (at least 10 characters)." }, values: formValues(fd), nonce: Date.now() };
  }
  if (courseGone(courseId)) return courseFieldGone(fd);
  const project = createProject(getDb(), { question, courseId });
  redirect(`/research/${project.id}`);
}

export async function deleteProjectAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (id) deleteProject(getDb(), id);
  redirect("/research");
}

export async function generatePlanAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const db = getDb();
  const project = getProject(db, idOf(fd));
  if (!project) return { ok: false, message: "This research question no longer exists.", nonce: Date.now() };
  try {
    await generatePlan(db, getProvider(), project, project.courseId ? getCourse(db, project.courseId) : null);
  } catch (error) {
    return aiFailed(error);
  }
  return done("Plan suggested. It is labelled as AI interpretation; keep what helps.");
}

export async function addSourceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const db = getDb();
  const projectId = String(fd.get("projectId") ?? "");
  if (!getProject(db, projectId)) return { ok: false, message: "This research question no longer exists.", nonce: Date.now() };
  const title = text(fd, "title", 500);
  const locator = text(fd, "locator", 500);
  const errors: Record<string, string> = {};
  if (!title) errors.title = "Give the source's title.";
  if (locator && !/^(https?:\/\/\S+|10\.\d{4,9}\/\S+|doi:\s*10\.\d{4,9}\/\S+|isbn[:\s]*[\d-xX]{10,17})$/i.test(locator)) {
    errors.locator = "Use a web link, a DOI like 10.1000/xyz, or an ISBN.";
  }
  if (Object.keys(errors).length) return { ok: false, errors, values: formValues(fd), nonce: Date.now() };
  addSource(db, projectId, {
    title: title as string,
    authors: text(fd, "authors", 500),
    year: text(fd, "year", 20),
    locator,
    notes: text(fd, "notes", 2000),
    relevance: RELEVANCE[String(fd.get("relevance") ?? "2") as keyof typeof RELEVANCE] ?? 2,
  });
  return done("Source added. Mark it verified once you have read and checked it.");
}

export async function setSourceVerifiedAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (id) setSourceVerified(getDb(), id, fd.get("verified") === "1");
  refresh();
}

export async function deleteSourceAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (id) deleteSource(getDb(), id);
  refresh();
}

export async function addNoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const db = getDb();
  const projectId = String(fd.get("projectId") ?? "");
  if (!getProject(db, projectId)) return { ok: false, message: "This research question no longer exists.", nonce: Date.now() };
  const body = text(fd, "body", 5000);
  const label = String(fd.get("label") ?? "mine");
  const sourceId = text(fd, "sourceId", 64);
  const errors: Record<string, string> = {};
  if (!body) errors.body = "Write the note.";
  if (!(NOTE_LABELS as readonly string[]).includes(label)) errors.label = "Pick a label.";
  if (label === "from-source" && !(sourceId && listSources(db, projectId).some((s) => s.id === sourceId))) errors.sourceId = "Pick the source this note comes from.";
  if (Object.keys(errors).length) return { ok: false, errors, values: formValues(fd), nonce: Date.now() };
  addNote(db, projectId, { body: body as string, label: label as NoteLabel, sourceId });
  return done("Note added.");
}

export async function deleteNoteAction(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (id) deleteNote(getDb(), id);
  refresh();
}

export async function saveReviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const weekStart = Number(fd.get("weekStart"));
  if (!Number.isInteger(weekStart) || startOfShanghaiWeek(weekStart) !== weekStart) return { ok: false, message: "Unknown week.", nonce: Date.now() };
  const db = getDb();
  const tasks = listTasks(db);
  const nextWeek = weekStart + 7 * DAY_MS;
  const chosen = fd.getAll("include").map(String);
  const items = chosen.map((taskId) => ({ taskId, day: Number(fd.get(`day-${taskId}`)) }));
  const errors = checkPlan(items, tasks, nextWeek);
  if (Object.keys(errors).length) {
    const values = { ...formValues(fd), ...Object.fromEntries(chosen.map((id) => [`include:${id}`, "1"])) };
    return { ok: false, message: Object.values(errors)[0], errors, values, nonce: Date.now() };
  }
  const titles = new Map(tasks.map((t) => [t.id, t.title]));
  saveReview(db, {
    weekStart,
    wentWell: text(fd, "wentWell", 3000),
    wasHard: text(fd, "wasHard", 3000),
    reflection: text(fd, "reflection", 5000),
    plan: items.map((i) => ({ ...i, title: titles.get(i.taskId) ?? "" })).sort((a, b) => a.day - b.day),
  });
  return done("Review saved. Next week's plan shows on Today each day.");
}

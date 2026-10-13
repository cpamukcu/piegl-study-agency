"use server";

import path from "node:path";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/connection";
import { createCourse, deleteCourse, getCourse, updateCourse } from "@/db/courses";
import { addMeetingTime, deleteMeetingTime } from "@/db/meetings";
import { createRule, deleteRule, materializePrepTasks } from "@/db/rules";
import { TASK_STATUSES, createTask, deleteTask, getTask, postponeTask, setTaskStatus, updateTask, type TaskStatus } from "@/db/tasks";
import { ImportError, describeImport, importSnapshots } from "@/import/run";
import { formValues, type ActionState } from "@/lib/action-state";
import { DataDirError, getDataDir } from "@/lib/data-dir";
import { parseCourseForm, parseMeetingForm, parseRuleForm, parseTaskForm, type FormResult } from "@/lib/forms";
import { DAY_MS } from "@/lib/time";

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

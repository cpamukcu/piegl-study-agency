import type { Task } from "@/db/tasks";

let counter = 0;

export function makeTask(overrides: Partial<Task> = {}): Task {
  counter += 1;
  return {
    id: `task-${counter}`,
    courseId: null,
    type: "assignment",
    title: `Task ${counter}`,
    dueAt: null,
    estMinutes: null,
    importance: 2,
    status: "todo",
    notes: null,
    source: "manual",
    externalId: null,
    ruleId: null,
    occurrenceKey: null,
    completedAt: null,
    deletedAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

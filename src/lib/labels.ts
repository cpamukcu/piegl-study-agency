import type { Importance, TaskType } from "@/db/tasks";

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  assignment: "Assignment",
  reading: "Reading",
  presentation: "Presentation",
  exam: "Exam",
  personal: "Personal",
  prep: "Class prep",
};

export const IMPORTANCE_LABELS: Record<Importance, string> = { 1: "Low", 2: "Normal", 3: "High" };

export const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

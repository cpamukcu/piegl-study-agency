import type { TronclassSnapshot } from "@/import/schemas";

export const NOT_ON_TODO_NOTE = "Not on your ZJU to-do list. You may have done it already.";

export type ImportedCourse = {
  externalId: string;
  title: string;
  code: string | null;
  instructor: string | null;
  semester: string | null;
  classNo: string | null;
};

export type ImportedTask = {
  externalId: string;
  courseExternalId: string;
  type: "assignment" | "exam";
  title: string;
  dueAt: number;
  notes: string | null;
};

export function classNoFromCode(code: string | null): string | null {
  if (!code) return null;
  const last = code.split("-").pop() ?? "";
  return /^\d+$/.test(last) ? last : null;
}

export function mapTronclass(
  snapshot: TronclassSnapshot,
  now: number,
): { courses: ImportedCourse[]; tasks: ImportedTask[]; skippedPast: number } {
  const onTodoList = new Set(snapshot.todos.map((t) => `${t.type === "exam" ? "exam" : "activity"}:${t.id}`));

  const courses = snapshot.courses.map((c) => ({
    externalId: `tc:course:${c.id}`,
    title: c.name,
    code: c.code,
    instructor: c.instructors.join(", ") || null,
    semester: c.semester,
    classNo: classNoFromCode(c.code),
  }));

  const tasks: ImportedTask[] = [];
  let skippedPast = 0;
  for (const c of snapshot.courses) {
    const candidates = [
      ...c.activities
        .filter((a) => a.end_time !== null && (a.type === "homework" || a.type === "forum"))
        .map((a) => ({
          key: `activity:${a.id}`,
          externalId: `tc:activity:${a.id}`,
          type: "assignment" as const,
          title: a.type === "forum" ? `Forum: ${a.title}` : a.title,
          end: a.end_time as string,
        })),
      ...c.exams
        .filter((e) => e.end_time !== null)
        .map((e) => ({
          key: `exam:${e.id}`,
          externalId: `tc:exam:${e.id}`,
          type: "exam" as const,
          title: e.title,
          end: e.end_time as string,
        })),
    ];
    for (const item of candidates) {
      const dueAt = Date.parse(item.end);
      if (Number.isNaN(dueAt)) continue;
      const onTodo = onTodoList.has(item.key);
      if (!onTodo && dueAt < now) {
        skippedPast += 1;
        continue;
      }
      tasks.push({
        externalId: item.externalId,
        courseExternalId: `tc:course:${c.id}`,
        type: item.type,
        title: item.title,
        dueAt,
        notes: onTodo ? null : NOT_ON_TODO_NOTE,
      });
    }
  }
  return { courses, tasks, skippedPast };
}

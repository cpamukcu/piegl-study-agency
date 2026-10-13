"use client";

import { useActionState } from "react";
import { deleteTaskAction, updateTaskAction } from "@/app/actions";
import { FieldError, FormMessage, invalidProps } from "@/components/field";
import { BUTTON_DANGER, BUTTON_PRIMARY, INPUT, LABEL } from "@/components/ui";
import type { Importance, TaskType } from "@/db/tasks";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { IMPORTANCE_LABELS } from "@/lib/labels";
import { toLocalDateTimeInput } from "@/lib/time";

type EditableTask = {
  id: string;
  title: string;
  type: TaskType;
  courseId: string | null;
  dueAt: number | null;
  estMinutes: number | null;
  importance: Importance;
  notes: string | null;
};

export function TaskEditor({ task }: { task: EditableTask }) {
  const [state, action, pending] = useActionState(updateTaskAction, INITIAL_ACTION_STATE);
  const f = `edit-${task.id}`;
  const v: Record<string, string> = state.values ?? {
    title: task.title,
    due: task.dueAt === null ? "" : toLocalDateTimeInput(task.dueAt),
    estMinutes: task.estMinutes === null ? "" : String(task.estMinutes),
    importance: String(task.importance),
    notes: task.notes ?? "",
  };
  const e = state.errors;

  return (
    <details className="mt-2 text-sm">
      <summary aria-label={`Edit "${task.title}"`} className="cursor-pointer text-ink-muted hover:text-ink">
        Edit
      </summary>
      <form key={state.nonce} action={action} noValidate className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="type" value={task.type} />
        <input type="hidden" name="courseId" value={task.courseId ?? ""} />
        <div className="sm:col-span-2">
          <label htmlFor={`${f}-title`} className={LABEL}>
            Title
          </label>
          <input id={`${f}-title`} name="title" defaultValue={v.title} className={INPUT} {...invalidProps(f, "title", e)} />
          <FieldError form={f} name="title" errors={e} />
        </div>
        <div>
          <label htmlFor={`${f}-due`} className={LABEL}>
            Due (Beijing time)
          </label>
          <input id={`${f}-due`} name="due" type="datetime-local" defaultValue={v.due} className={INPUT} {...invalidProps(f, "due", e)} />
          <FieldError form={f} name="due" errors={e} />
        </div>
        <div>
          <label htmlFor={`${f}-estMinutes`} className={LABEL}>
            Estimated minutes
          </label>
          <input
            id={`${f}-estMinutes`}
            name="estMinutes"
            type="number"
            min={1}
            step={5}
            defaultValue={v.estMinutes}
            className={INPUT}
            {...invalidProps(f, "estMinutes", e)}
          />
          <FieldError form={f} name="estMinutes" errors={e} />
        </div>
        <div>
          <label htmlFor={`${f}-importance`} className={LABEL}>
            Importance
          </label>
          <select id={`${f}-importance`} name="importance" defaultValue={v.importance} className={INPUT}>
            {([1, 2, 3] as const).map((n) => (
              <option key={n} value={n}>
                {IMPORTANCE_LABELS[n]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${f}-notes`} className={LABEL}>
            Notes
          </label>
          <textarea id={`${f}-notes`} name="notes" rows={2} defaultValue={v.notes} className={INPUT} {...invalidProps(f, "notes", e)} />
          <FieldError form={f} name="notes" errors={e} />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
            Save
          </button>
          <button type="submit" formAction={deleteTaskAction} formNoValidate className={BUTTON_DANGER}>
            Delete task
          </button>
          <FormMessage state={state} />
        </div>
      </form>
    </details>
  );
}

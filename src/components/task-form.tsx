"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTaskAction } from "@/app/actions";
import { FieldError, FormMessage, invalidProps } from "@/components/field";
import { BUTTON_PRIMARY, CARD, INPUT, LABEL } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { IMPORTANCE_LABELS, TASK_TYPE_LABELS } from "@/lib/labels";

type CourseOption = { id: string; title: string };

export function TaskForm({ courses, defaultCourseId = "" }: { courses: CourseOption[]; defaultCourseId?: string }) {
  const [state, action, pending] = useActionState(createTaskAction, INITIAL_ACTION_STATE);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusIfAsked = () => {
      if (window.location.hash === "#new-task") titleRef.current?.focus();
    };
    focusIfAsked();
    window.addEventListener("hashchange", focusIfAsked);
    return () => window.removeEventListener("hashchange", focusIfAsked);
  }, []);

  const v = state.values ?? {};
  const e = state.errors;

  return (
    <section id="new-task" aria-labelledby="new-task-heading" className={`${CARD} scroll-mt-8`}>
      <h2 id="new-task-heading" className="text-lg">
        Add a task
      </h2>
      <form key={state.nonce} action={action} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="task-title" className={LABEL}>
            Title
          </label>
          <input ref={titleRef} id="task-title" name="title" defaultValue={v.title} className={INPUT} {...invalidProps("task", "title", e)} />
          <FieldError form="task" name="title" errors={e} />
        </div>
        <div>
          <label htmlFor="task-courseId" className={LABEL}>
            Course
          </label>
          <select
            id="task-courseId"
            name="courseId"
            defaultValue={v.courseId ?? defaultCourseId}
            className={INPUT}
            {...invalidProps("task", "courseId", e)}
          >
            <option value="">No course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <FieldError form="task" name="courseId" errors={e} />
        </div>
        <div>
          <label htmlFor="task-type" className={LABEL}>
            Type
          </label>
          <select id="task-type" name="type" defaultValue={v.type ?? "assignment"} className={INPUT} {...invalidProps("task", "type", e)}>
            {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldError form="task" name="type" errors={e} />
        </div>
        <div>
          <label htmlFor="task-due" className={LABEL}>
            Due (Beijing time)
          </label>
          <input id="task-due" name="due" type="datetime-local" defaultValue={v.due} className={INPUT} {...invalidProps("task", "due", e)} />
          <FieldError form="task" name="due" errors={e} />
        </div>
        <div>
          <label htmlFor="task-estMinutes" className={LABEL}>
            Estimated minutes
          </label>
          <input
            id="task-estMinutes"
            name="estMinutes"
            type="number"
            min={1}
            step={5}
            inputMode="numeric"
            defaultValue={v.estMinutes}
            className={INPUT}
            {...invalidProps("task", "estMinutes", e)}
          />
          <FieldError form="task" name="estMinutes" errors={e} />
        </div>
        <div>
          <label htmlFor="task-importance" className={LABEL}>
            Importance
          </label>
          <select id="task-importance" name="importance" defaultValue={v.importance ?? "2"} className={INPUT}>
            {([1, 2, 3] as const).map((n) => (
              <option key={n} value={n}>
                {IMPORTANCE_LABELS[n]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="task-notes" className={LABEL}>
            Notes
          </label>
          <textarea id="task-notes" name="notes" rows={2} defaultValue={v.notes} className={INPUT} {...invalidProps("task", "notes", e)} />
          <FieldError form="task" name="notes" errors={e} />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
            {pending ? "Adding…" : "Add task"}
          </button>
          <FormMessage state={state} />
        </div>
      </form>
    </section>
  );
}

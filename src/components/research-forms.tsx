"use client";

import { useActionState, useState } from "react";
import { addNoteAction, addSourceAction, createProjectAction, generatePlanAction } from "@/app/actions";
import { FieldError, FormMessage, invalidProps } from "@/components/field";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LABEL } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";

export function ProjectForm({ courses }: { courses: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(createProjectAction, INITIAL_ACTION_STATE);
  const v = state.values ?? {};
  return (
    <form key={state.nonce} action={action} noValidate className="mt-4 grid gap-4">
      <div>
        <label htmlFor="project-question" className={LABEL}>
          Research question
        </label>
        <textarea id="project-question" name="question" rows={2} defaultValue={v.question} className={INPUT} {...invalidProps("project", "question", state.errors)} />
        <FieldError form="project" name="question" errors={state.errors} />
      </div>
      <div>
        <label htmlFor="project-course" className={LABEL}>
          Course (optional)
        </label>
        <select id="project-course" name="courseId" defaultValue={v.courseId ?? ""} className={INPUT} {...invalidProps("project", "courseId", state.errors)}>
          <option value="">No course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <FieldError form="project" name="courseId" errors={state.errors} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
          Start
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function PlanButton({ projectId, disabled, again }: { projectId: string; disabled: boolean; again: boolean }) {
  const [state, action, pending] = useActionState(generatePlanAction, INITIAL_ACTION_STATE);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={projectId} />
      <button type="submit" disabled={pending || disabled} className={again ? BUTTON_SECONDARY : BUTTON_PRIMARY}>
        {pending ? "Thinking…" : again ? "Suggest a new plan" : "Suggest a plan"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function SourceForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(addSourceAction, INITIAL_ACTION_STATE);
  const v = state.values ?? {};
  const e = state.errors;
  return (
    <form key={state.nonce} action={action} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="sm:col-span-2">
        <label htmlFor="source-title" className={LABEL}>
          Title
        </label>
        <input id="source-title" name="title" defaultValue={v.title} className={INPUT} {...invalidProps("source", "title", e)} />
        <FieldError form="source" name="title" errors={e} />
      </div>
      <div>
        <label htmlFor="source-authors" className={LABEL}>
          Authors
        </label>
        <input id="source-authors" name="authors" defaultValue={v.authors} className={INPUT} />
      </div>
      <div>
        <label htmlFor="source-year" className={LABEL}>
          Year
        </label>
        <input id="source-year" name="year" inputMode="numeric" defaultValue={v.year} className={INPUT} />
      </div>
      <div>
        <label htmlFor="source-locator" className={LABEL}>
          Link, DOI or ISBN
        </label>
        <input id="source-locator" name="locator" defaultValue={v.locator} className={INPUT} {...invalidProps("source", "locator", e)} />
        <FieldError form="source" name="locator" errors={e} />
      </div>
      <div>
        <label htmlFor="source-relevance" className={LABEL}>
          Relevance
        </label>
        <select id="source-relevance" name="relevance" defaultValue={v.relevance ?? "2"} className={INPUT}>
          <option value="3">High</option>
          <option value="2">Medium</option>
          <option value="1">Low</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="source-notes" className={LABEL}>
          Why it matters
        </label>
        <textarea id="source-notes" name="notes" rows={2} defaultValue={v.notes} className={INPUT} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
          Add source
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function NoteForm({ projectId, sources }: { projectId: string; sources: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(addNoteAction, INITIAL_ACTION_STATE);
  const v = state.values ?? {};
  const e = state.errors;
  const [label, setLabel] = useState(v.label ?? "mine");
  return (
    <form key={state.nonce} action={action} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="sm:col-span-2">
        <label htmlFor="note-body" className={LABEL}>
          Note
        </label>
        <textarea id="note-body" name="body" rows={3} defaultValue={v.body} className={INPUT} {...invalidProps("note", "body", e)} />
        <FieldError form="note" name="body" errors={e} />
      </div>
      <div>
        <label htmlFor="note-label" className={LABEL}>
          Whose idea is this?
        </label>
        <select id="note-label" name="label" value={label} onChange={(ev) => setLabel(ev.target.value)} className={INPUT}>
          <option value="mine">Mine</option>
          <option value="from-source" disabled={sources.length === 0}>
            From a source
          </option>
          <option value="ai-interpretation">AI interpretation</option>
        </select>
      </div>
      {label === "from-source" && (
        <div>
          <label htmlFor="note-source" className={LABEL}>
            Source
          </label>
          <select id="note-source" name="sourceId" defaultValue={v.sourceId} className={INPUT} {...invalidProps("note", "sourceId", e)}>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <FieldError form="note" name="sourceId" errors={e} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
          Add note
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { addQuestionAction } from "@/app/actions";
import { FieldError, FormMessage, invalidProps } from "@/components/field";
import { BUTTON_PRIMARY, CARD, INPUT, LABEL } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";

export function QuestionForm({ courses }: { courses: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(addQuestionAction, INITIAL_ACTION_STATE);
  const v = state.values ?? {};
  return (
    <section aria-labelledby="new-question-heading" className={CARD}>
      <h2 id="new-question-heading" className="text-lg">
        Add your own question
      </h2>
      <form key={state.nonce} action={action} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="question-text" className={LABEL}>
            Question
          </label>
          <textarea id="question-text" name="question" rows={2} defaultValue={v.question} className={INPUT} {...invalidProps("question", "question", state.errors)} />
          <FieldError form="question" name="question" errors={state.errors} />
        </div>
        <div>
          <label htmlFor="question-course" className={LABEL}>
            Course
          </label>
          <select id="question-course" name="courseId" defaultValue={v.courseId} className={INPUT} {...invalidProps("question", "courseId", state.errors)}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <FieldError form="question" name="courseId" errors={state.errors} />
        </div>
        <div>
          <label htmlFor="question-kind" className={LABEL}>
            Kind
          </label>
          <select id="question-kind" name="kind" defaultValue={v.kind ?? "explain"} className={INPUT}>
            <option value="recall">Recall</option>
            <option value="explain">Explain</option>
            <option value="apply">Apply</option>
            <option value="critique">Critique</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
            Add question
          </button>
          <FormMessage state={state} />
        </div>
      </form>
    </section>
  );
}

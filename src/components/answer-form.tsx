"use client";

import { useActionState } from "react";
import { assessAnswerAction } from "@/app/actions";
import { FormMessage } from "@/components/field";
import { BUTTON_PRIMARY, INPUT, LABEL } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";

export function AnswerForm({ questionId, disabled }: { questionId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(assessAnswerAction, INITIAL_ACTION_STATE);
  return (
    <form key={state.nonce} action={action} className="mt-4">
      <input type="hidden" name="id" value={questionId} />
      <label htmlFor="answer" className={LABEL}>
        Your answer, in your own words, as you would say it in class
      </label>
      <textarea id="answer" name="answer" rows={7} maxLength={6000} defaultValue={state.ok ? "" : state.values?.answer} className={INPUT} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || disabled} className={BUTTON_PRIMARY}>
          {pending ? "Assessing…" : "Get feedback"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

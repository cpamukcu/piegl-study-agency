"use client";

import { useActionState } from "react";
import { createRuleAction } from "@/app/actions";
import { FieldError, FormMessage, invalidProps } from "@/components/field";
import { BUTTON_SECONDARY, INPUT, LABEL } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { IMPORTANCE_LABELS } from "@/lib/labels";

export function RuleForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(createRuleAction, INITIAL_ACTION_STATE);
  const v = state.values ?? {};
  const e = state.errors;
  return (
    <form key={state.nonce} action={action} noValidate className="mt-4 grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="sm:col-span-4">
        <label htmlFor="rule-title" className={LABEL}>
          Task name
        </label>
        <input id="rule-title" name="title" placeholder="Prepare for class" defaultValue={v.title} className={INPUT} />
      </div>
      <div>
        <label htmlFor="rule-leadHours" className={LABEL}>
          Hours before class
        </label>
        <input id="rule-leadHours" name="leadHours" type="number" min={0} step={0.5} defaultValue={v.leadHours ?? "12"} className={INPUT} {...invalidProps("rule", "leadHours", e)} />
        <FieldError form="rule" name="leadHours" errors={e} />
      </div>
      <div>
        <label htmlFor="rule-estMinutes" className={LABEL}>
          Minutes needed
        </label>
        <input id="rule-estMinutes" name="estMinutes" type="number" min={1} step={5} defaultValue={v.estMinutes ?? "45"} className={INPUT} {...invalidProps("rule", "estMinutes", e)} />
        <FieldError form="rule" name="estMinutes" errors={e} />
      </div>
      <div>
        <label htmlFor="rule-importance" className={LABEL}>
          Importance
        </label>
        <select id="rule-importance" name="importance" defaultValue={v.importance ?? "2"} className={INPUT}>
          {([1, 2, 3] as const).map((n) => (
            <option key={n} value={n}>
              {IMPORTANCE_LABELS[n]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
        <button type="submit" disabled={pending} className={BUTTON_SECONDARY}>
          Add prep routine
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

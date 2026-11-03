"use client";

import { useActionState } from "react";
import { saveReviewAction } from "@/app/actions";
import { FormMessage } from "@/components/field";
import { BUTTON_PRIMARY, INPUT, LABEL } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";

export type PlanRow = { taskId: string; title: string; detail: string; maxDay: number; day: number; included: boolean; warning: string | null };

export function ReviewForm({
  weekStart,
  dayLabels,
  rows,
  defaults,
}: {
  weekStart: number;
  dayLabels: string[];
  rows: PlanRow[];
  defaults: { wentWell: string; wasHard: string; reflection: string };
}) {
  const [state, action, pending] = useActionState(saveReviewAction, INITIAL_ACTION_STATE);
  const v = state.values;
  // After a refused save, keep what was ticked (the action echoes each one as "include:<id>").
  const included = (id: string, fallback: boolean) => (v ? v[`include:${id}`] === "1" : fallback);
  return (
    <form key={state.nonce} action={action} className="space-y-6">
      <input type="hidden" name="weekStart" value={weekStart} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="review-wentWell" className={LABEL}>
            What went well?
          </label>
          <textarea id="review-wentWell" name="wentWell" rows={3} defaultValue={v?.wentWell ?? defaults.wentWell} className={INPUT} />
        </div>
        <div>
          <label htmlFor="review-wasHard" className={LABEL}>
            What was hard, or slipped?
          </label>
          <textarea id="review-wasHard" name="wasHard" rows={3} defaultValue={v?.wasHard ?? defaults.wasHard} className={INPUT} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="review-reflection" className={LABEL}>
            What will you do differently next week?
          </label>
          <textarea id="review-reflection" name="reflection" rows={3} defaultValue={v?.reflection ?? defaults.reflection} className={INPUT} />
        </div>
      </div>

      <fieldset>
        <legend className="font-serif text-lg">Next week&rsquo;s plan</legend>
        <p className="mt-1 text-sm text-ink-muted">
          Suggested from your deadlines and estimates, earliest deadline first, about 3 hours a day. Untick or move anything; a task can never be planned after its
          deadline.
        </p>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">Nothing due next week. Enjoy the room, or plan research and reading.</p>
        ) : (
          <ul className="mt-3">
            {rows.map((row) => (
              <li key={row.taskId} className="flex items-center gap-3 border-b border-line py-2 text-sm last:border-b-0">
                <label className="flex min-w-0 flex-1 items-start gap-2">
                  <input type="checkbox" name="include" value={row.taskId} defaultChecked={included(row.taskId, row.included)} className="mt-1" />
                  <span>
                    {row.title}
                    <span className="block text-ink-muted">{row.detail}</span>
                    {row.warning && <span className="block text-warn">{row.warning}</span>}
                    {state.errors?.[row.taskId] && <span className="block text-warn">{state.errors[row.taskId]}</span>}
                  </span>
                </label>
                <label className="sr-only" htmlFor={`day-${row.taskId}`}>
                  Day for {row.title}
                </label>
                <div className="w-32 shrink-0">
                  <select id={`day-${row.taskId}`} name={`day-${row.taskId}`} defaultValue={v?.[`day-${row.taskId}`] ?? String(row.day)} className={INPUT}>
                    {dayLabels.slice(0, row.maxDay + 1).map((label, d) => (
                      <option key={d} value={d}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
          Save review and plan
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

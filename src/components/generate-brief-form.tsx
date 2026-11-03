"use client";

import { useActionState } from "react";
import { generateBriefAction } from "@/app/actions";
import { FormMessage } from "@/components/field";
import { BUTTON_PRIMARY } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";

export function GenerateBriefForm({ courseId, materialIds, classAt, disabled }: { courseId: string; materialIds: string[]; classAt: number | null; disabled: boolean }) {
  const [state, action, pending] = useActionState(generateBriefAction, INITIAL_ACTION_STATE);
  return (
    <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
      <input type="hidden" name="courseId" value={courseId} />
      {materialIds.map((id) => (
        <input key={id} type="hidden" name="material" value={id} />
      ))}
      {classAt ? <input type="hidden" name="classAt" value={classAt} /> : null}
      <button type="submit" disabled={pending || disabled} className={BUTTON_PRIMARY}>
        {pending ? "Writing the brief… (up to a minute)" : "Send and make the brief"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

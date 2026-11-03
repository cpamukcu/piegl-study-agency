"use client";

import { useActionState } from "react";
import { uploadMaterialAction } from "@/app/actions";
import { FieldError, FormMessage, invalidProps } from "@/components/field";
import { BUTTON_PRIMARY, INPUT, LABEL } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";

export function MaterialUpload({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(uploadMaterialAction, INITIAL_ACTION_STATE);
  return (
    <form key={state.nonce} action={action} className="mt-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="min-w-0 flex-1">
        <label htmlFor="material-file" className={LABEL}>
          Add slides or readings (PDF, PPTX, text; up to 50 MB each)
        </label>
        <input
          id="material-file"
          name="file"
          type="file"
          multiple
          accept=".pdf,.pptx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown"
          className={INPUT}
          {...invalidProps("material", "file", state.errors)}
        />
        <FieldError form="material" name="file" errors={state.errors} />
      </div>
      <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
        {pending ? "Reading…" : "Upload"}
      </button>
      <div className="basis-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

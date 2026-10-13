"use client";

import { useActionState } from "react";
import { importSnapshotsAction } from "@/app/actions";
import { FormMessage } from "@/components/field";
import { BUTTON_PRIMARY } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";

export function ImportPanel({ files }: { files: string[] }) {
  const [state, action, pending] = useActionState(importSnapshotsAction, INITIAL_ACTION_STATE);
  return (
    <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending || files.length === 0} className={BUTTON_PRIMARY}>
        {pending ? "Importing…" : "Import ZJU snapshots"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

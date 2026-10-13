"use client";

import { useActionState } from "react";
import { addMeetingAction } from "@/app/actions";
import { FieldError, FormMessage, invalidProps } from "@/components/field";
import { BUTTON_SECONDARY, INPUT, LABEL } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { WEEKDAY_LABELS } from "@/lib/labels";

export function MeetingForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(addMeetingAction, INITIAL_ACTION_STATE);
  const v = state.values ?? {};
  const e = state.errors;
  return (
    <form key={state.nonce} action={action} noValidate className="mt-4 grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div>
        <label htmlFor="meeting-weekday" className={LABEL}>
          Day
        </label>
        <select id="meeting-weekday" name="weekday" defaultValue={v.weekday ?? "1"} className={INPUT} {...invalidProps("meeting", "weekday", e)}>
          {WEEKDAY_LABELS.map((label, i) => (
            <option key={label} value={i + 1}>
              {label}
            </option>
          ))}
        </select>
        <FieldError form="meeting" name="weekday" errors={e} />
      </div>
      <div>
        <label htmlFor="meeting-start" className={LABEL}>
          Starts
        </label>
        <input id="meeting-start" name="start" type="time" defaultValue={v.start} className={INPUT} {...invalidProps("meeting", "start", e)} />
        <FieldError form="meeting" name="start" errors={e} />
      </div>
      <div>
        <label htmlFor="meeting-end" className={LABEL}>
          Ends
        </label>
        <input id="meeting-end" name="end" type="time" defaultValue={v.end} className={INPUT} {...invalidProps("meeting", "end", e)} />
        <FieldError form="meeting" name="end" errors={e} />
      </div>
      <div>
        <label htmlFor="meeting-room" className={LABEL}>
          Room
        </label>
        <input id="meeting-room" name="room" defaultValue={v.room} className={INPUT} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
        <button type="submit" disabled={pending} className={BUTTON_SECONDARY}>
          Add class time
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

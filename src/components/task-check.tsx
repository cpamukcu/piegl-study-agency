"use client";

import { useFormStatus } from "react-dom";
import { Icon } from "@/components/icons";

// The round checkbox in a task row. It submits the surrounding status form and
// shows the new state straight away while the action runs.
export function TaskCheck({ done, title }: { done: boolean; title: string }) {
  const { pending } = useFormStatus();
  const checked = pending ? !done : done;
  const label = done ? `Reopen "${title}"` : `Mark "${title}" done`;
  return (
    <button
      type="submit"
      aria-label={label}
      title={done ? "Reopen" : "Mark done"}
      className={`group/check flex size-[26px] items-center justify-center rounded-full transition-all duration-200 ease-out active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        checked ? "bg-action text-white shadow-card" : "border-2 border-line-strong bg-white text-transparent hover:border-lavender hover:text-lilac"
      }`}
    >
      <Icon name="check" strokeWidth={2.6} className={`size-3.5 transition-transform duration-200 ${checked ? "scale-100" : "scale-75"}`} />
    </button>
  );
}

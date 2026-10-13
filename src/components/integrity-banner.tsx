"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { BUTTON_PRIMARY } from "@/components/ui";
import { INTEGRITY_ACK_KEY, INTEGRITY_TEXT } from "@/lib/integrity";

function readAck(): boolean {
  try {
    return window.localStorage.getItem(INTEGRITY_ACK_KEY) === "yes";
  } catch {
    return false;
  }
}

function writeAck(): void {
  try {
    window.localStorage.setItem(INTEGRITY_ACK_KEY, "yes");
  } catch {
    // Storage is blocked; the banner simply returns on the next visit.
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function IntegrityBanner() {
  // Server snapshot is "acknowledged" so the banner never flashes during server render.
  const acknowledged = useSyncExternalStore(subscribe, readAck, () => true);
  const [dismissed, setDismissed] = useState(false);

  if (acknowledged || dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Before you start"
      className="mb-8 flex flex-col gap-4 rounded-[24px] bg-wash p-5 ring-1 ring-lavender/25 sm:flex-row sm:items-center sm:p-6"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-lavender shadow-card">
        <Icon name="shield" className="size-[22px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[17px] font-bold text-ink">Before you start</p>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-body">{INTEGRITY_TEXT}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          writeAck();
          setDismissed(true);
        }}
        className={`${BUTTON_PRIMARY} self-start sm:self-center`}
      >
        I understand
      </button>
    </div>
  );
}

"use client";

import { useState, useSyncExternalStore } from "react";
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
    <div role="region" aria-label="Before you start" className="mb-8 rounded-lg border border-accent/40 bg-surface p-4">
      <p className="font-serif text-lg">Before you start</p>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-muted">{INTEGRITY_TEXT}</p>
      <button
        type="button"
        onClick={() => {
          writeAck();
          setDismissed(true);
        }}
        className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        I understand
      </button>
    </div>
  );
}

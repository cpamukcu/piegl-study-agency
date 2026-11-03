// The current focus session, kept in this browser's localStorage so a running
// session survives a reload. Read it with useSyncExternalStore.
import { parseSession, type FocusSession } from "@/lib/focus";

export const FOCUS_KEY = "psa.focusSession.v1";

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: FocusSession | null = null;
let memoryOnly = false; // set when storage refuses writes

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(FOCUS_KEY);
  } catch {
    return null;
  }
}

export function getFocusSnapshot(): FocusSession | null {
  if (memoryOnly) return cached;
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseSession(raw);
  }
  return cached;
}

export function getFocusServerSnapshot(): FocusSession | null {
  return null;
}

export function subscribeFocus(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === FOCUS_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function saveFocus(session: FocusSession | null): void {
  try {
    if (session) window.localStorage.setItem(FOCUS_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(FOCUS_KEY);
  } catch {
    // Storage is blocked: keep the session in memory for this page only.
    memoryOnly = true;
    cached = session;
  }
  for (const listener of listeners) listener();
}

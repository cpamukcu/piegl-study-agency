"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef } from "react";
import { BUTTON_SECONDARY } from "@/components/ui";

export const SHORTCUTS = [
  { key: "n", label: "New task", href: "/deadlines#new-task", focusId: "task-title" },
  { key: "c", label: "New course", href: "/courses#new-course", focusId: "course-title" },
  { key: "t", label: "Go to Today", href: "/today", focusId: null },
  { key: "d", label: "Go to Deadlines", href: "/deadlines", focusId: null },
] as const;

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function Shortcuts() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;

      if (event.key === "?") {
        event.preventDefault();
        const dialog = dialogRef.current;
        if (!dialog) return;
        // jsdom and older browsers may lack showModal/close; fall back to the attribute.
        if (dialog.open) {
          if (typeof dialog.close === "function") dialog.close();
          else dialog.removeAttribute("open");
        } else if (typeof dialog.showModal === "function") {
          dialog.showModal();
        } else {
          dialog.setAttribute("open", "");
        }
        return;
      }

      const shortcut = SHORTCUTS.find((s) => s.key === event.key);
      if (!shortcut) return;
      event.preventDefault();
      // Focus the form only on its own page; elsewhere (e.g. a course's edit form) go to that page.
      const [path] = shortcut.href.split("#");
      const field = shortcut.focusId && window.location.pathname === path ? document.getElementById(shortcut.focusId) : null;
      if (field) {
        field.focus();
        field.scrollIntoView?.({ block: "center" });
      } else {
        router.push(shortcut.href);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="shortcuts-heading"
      className="m-auto rounded-lg border border-line bg-surface p-6 text-ink backdrop:bg-black/30"
    >
      <h2 id="shortcuts-heading" className="font-serif text-lg">
        Keyboard shortcuts
      </h2>
      <dl className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
        {[...SHORTCUTS, { key: "?", label: "Show or hide this list" }].map((s) => (
          <Fragment key={s.key}>
            <dt>
              <kbd className="rounded border border-line px-1.5 font-mono">{s.key}</kbd>
            </dt>
            <dd>{s.label}</dd>
          </Fragment>
        ))}
      </dl>
      <form method="dialog" className="mt-4">
        <button type="submit" className={BUTTON_SECONDARY}>
          Close
        </button>
      </form>
    </dialog>
  );
}

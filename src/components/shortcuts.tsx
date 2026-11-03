"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef } from "react";
import { BUTTON_SECONDARY } from "@/components/ui";
import { SHORTCUTS } from "@/lib/shortcuts";


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
      className="m-auto w-[min(92vw,380px)] rounded-[24px] bg-surface p-6 text-body shadow-lift backdrop:bg-[#302a52]/25 backdrop:backdrop-blur-sm"
    >
      <h2 id="shortcuts-heading" className="text-xl">
        Keyboard shortcuts
      </h2>
      <dl className="mt-5 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 text-[15px]">
        {[...SHORTCUTS, { key: "?", label: "Show or hide this list" }].map((s) => (
          <Fragment key={s.key}>
            <dt>
              <kbd className="inline-flex min-w-8 justify-center rounded-lg border border-line-strong bg-tint px-2 py-0.5 font-sans text-sm font-semibold text-ink">{s.key}</kbd>
            </dt>
            <dd>{s.label}</dd>
          </Fragment>
        ))}
      </dl>
      <form method="dialog" className="mt-6">
        <button type="submit" className={BUTTON_SECONDARY}>
          Close
        </button>
      </form>
    </dialog>
  );
}

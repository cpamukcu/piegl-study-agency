"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "@/lib/nav";

const ICON = "h-6 w-6";

const TABS = [
  { href: "/today", label: "Today", icon: <path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" fill="currentColor" /> },
  {
    href: "/deadlines",
    label: "Deadlines",
    icon: (
      <g fill="currentColor">
        <rect x="4" y="12" width="4" height="8" rx="1" />
        <rect x="10" y="8" width="4" height="12" rx="1" />
        <rect x="16" y="4" width="4" height="16" rx="1" />
      </g>
    ),
  },
  { href: "/courses", label: "Courses", icon: <path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" fill="currentColor" /> },
  {
    href: "/prepare",
    label: "Prepare",
    icon: <path d="M6 3h11a2 2 0 0 1 2 2v16l-7-4-7 4V5a2 2 0 0 1 1-2z" fill="currentColor" />,
  },
] as const;

const MORE = [
  { href: "/practice", label: "Practice" },
  { href: "/research", label: "Research" },
  { href: "/review", label: "Weekly Review" },
  { href: "/settings", label: "Settings" },
] as const;

export function TabBar() {
  return <TabBarLinks pathname={usePathname() ?? ""} />;
}

// Bottom navigation for narrow screens. Also the Suspense fallback, like NavLinks.
export function TabBarLinks({ pathname }: { pathname: string }) {
  const moreActive = MORE.some((m) => isActive(pathname, m.href));
  const tab = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "font-semibold text-accent" : "text-ink-muted"}`;

  return (
    <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="flex">
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <li key={t.href} className="flex flex-1">
              <Link href={t.href} aria-current={active ? "page" : undefined} className={tab(active)}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className={ICON}>
                  {t.icon}
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
        <li className="relative flex flex-1">
          <details className="group flex flex-1">
            <summary className={`${tab(moreActive)} cursor-pointer list-none`}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className={ICON} fill="currentColor">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
              More
            </summary>
            <ul className="absolute bottom-full right-2 mb-2 w-44 rounded-2xl bg-surface p-2 shadow-soft">
              {MORE.map((m) => {
                const active = isActive(pathname, m.href);
                return (
                  <li key={m.href}>
                    <Link
                      href={m.href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-xl px-3 py-2 text-sm ${active ? "bg-hot font-semibold text-white" : "text-ink hover:bg-surface-strong"}`}
                    >
                      {m.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        </li>
      </ul>
    </nav>
  );
}

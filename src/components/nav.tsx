"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "@/lib/nav";

export function Nav() {
  return <NavLinks pathname={usePathname() ?? ""} />;
}

// Also the Suspense fallback in the layout: on pages with an unknown dynamic
// segment the pathname is only known at request time.
export function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  active
                    ? "bg-hot font-semibold text-white shadow-soft"
                    : "text-ink-muted hover:bg-surface-strong hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

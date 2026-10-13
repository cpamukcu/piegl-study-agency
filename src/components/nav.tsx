"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { NAV_ITEMS, SETTINGS_ITEM, isActive, type NavItem } from "@/lib/nav";

export function Nav() {
  return <NavLinks pathname={usePathname() ?? ""} />;
}

function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-2xl px-2 py-1.5 text-[15px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        active ? "bg-pill font-semibold text-ink" : "font-medium text-ink hover:bg-tint"
      }`}
    >
      <span
        className={`flex size-9 items-center justify-center rounded-xl transition-colors duration-200 ${
          active ? "bg-white text-accent shadow-card" : "text-faint group-hover:text-lavender"
        }`}
      >
        <Icon name={item.icon} className="size-[19px]" />
      </span>
      {item.label}
    </Link>
  );
}

// Also the Suspense fallback in the layout: on pages with an unknown dynamic
// segment the pathname is only known at request time.
export function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <RailLink item={item} pathname={pathname} />
          </li>
        ))}
      </ul>
      <div className="mt-auto border-t border-line pt-4">
        <RailLink item={SETTINGS_ITEM} pathname={pathname} />
      </div>
    </nav>
  );
}

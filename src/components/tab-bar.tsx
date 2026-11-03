"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { PROFILE_ITEMS, TAB_ITEMS, isActive } from "@/lib/nav";

export function TabBar() {
  return <TabBarLinks pathname={usePathname() ?? ""} />;
}

function TabFace({ icon, label, active }: { icon: IconName; label: string; active: boolean }) {
  return (
    <>
      <span
        className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-200 ${active ? "bg-pill text-accent" : "text-faint"}`}
      >
        <Icon name={icon} className="size-[22px]" />
      </span>
      <span className={active ? "font-semibold text-accent" : "font-medium text-ink-muted"}>{label}</span>
    </>
  );
}

const TAB = "flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent";

// Bottom navigation for narrow screens. Also the Suspense fallback, like NavLinks.
export function TabBarLinks({ pathname }: { pathname: string }) {
  const profileActive = PROFILE_ITEMS.some((m) => isActive(pathname, m.href));

  return (
    <nav
      aria-label="Tabs"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-nav backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex max-w-lg px-1">
        {TAB_ITEMS.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <li key={t.href} className="flex flex-1">
              <Link href={t.href} aria-current={active ? "page" : undefined} className={TAB}>
                <TabFace icon={t.icon} label={t.label} active={active} />
              </Link>
            </li>
          );
        })}
        <li className="relative flex flex-1">
          {/* Keyed on the page so the sheet closes after choosing a section. */}
          <details key={pathname} className="group flex flex-1">
            <summary className={`${TAB} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
              <TabFace icon="profile" label="Profile" active={profileActive} />
            </summary>
            <div className="absolute bottom-full right-2 mb-3 w-64 rounded-[22px] bg-white p-2 shadow-lift ring-1 ring-line">
              <p className="px-3 pb-2 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Your study space</p>
              <ul>
                {PROFILE_ITEMS.map((m) => {
                  const active = isActive(pathname, m.href);
                  return (
                    <li key={m.href}>
                      <Link
                        href={m.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] ${
                          active ? "bg-pill font-semibold text-ink" : "font-medium text-ink hover:bg-tint"
                        }`}
                      >
                        <Icon name={m.icon} className={`size-5 ${active ? "text-accent" : "text-faint"}`} />
                        {m.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        </li>
      </ul>
    </nav>
  );
}

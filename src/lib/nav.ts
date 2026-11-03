import type { IconName } from "@/components/icons";

export type NavItem = { href: string; label: string; icon: IconName };

// Desktop rail, top to bottom. Settings sits on its own at the bottom of the rail.
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/timetable", label: "Timetable", icon: "timetable" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/deadlines", label: "Deadlines", icon: "deadlines" },
  { href: "/courses", label: "Courses", icon: "courses" },
  { href: "/prepare", label: "Prepare", icon: "prepare" },
  { href: "/research", label: "Research", icon: "research" },
  { href: "/practice", label: "Practice", icon: "practice" },
  { href: "/review", label: "Weekly Review", icon: "review" },
];

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: "settings" };

// Phone tab bar: four tabs, then a Profile sheet that holds everything else.
export const TAB_ITEMS: readonly NavItem[] = NAV_ITEMS.slice(0, 4);
export const PROFILE_ITEMS: readonly NavItem[] = [...NAV_ITEMS.slice(4), SETTINGS_ITEM];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type NavItem = { href: string; label: string };

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/today", label: "Today" },
  { href: "/courses", label: "Courses" },
  { href: "/deadlines", label: "Deadlines" },
  { href: "/prepare", label: "Prepare Class" },
  { href: "/research", label: "Research" },
  { href: "/practice", label: "Practice" },
  { href: "/review", label: "Weekly Review" },
  { href: "/settings", label: "Settings" },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

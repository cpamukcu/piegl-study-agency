// Keyboard shortcuts. Kept outside the client component so server pages can list them too.
export const SHORTCUTS = [
  { key: "n", label: "New task", href: "/deadlines#new-task", focusId: "task-title" },
  { key: "c", label: "New course", href: "/courses#new-course", focusId: "course-title" },
  { key: "t", label: "Go to Today", href: "/today", focusId: null },
  { key: "d", label: "Go to Deadlines", href: "/deadlines", focusId: null },
] as const;

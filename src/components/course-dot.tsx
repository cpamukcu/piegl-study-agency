export function CourseDot({ color, size = "sm" }: { color: string; size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ring-2 ring-white ${size === "lg" ? "size-4" : "size-2.5"}`}
      style={{ backgroundColor: color }}
    />
  );
}

// A course name with its colour dot, for metadata lines.
export function CourseBadge({ course }: { course: { title: string; color: string } | null }) {
  if (!course) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <CourseDot color={course.color} />
      <span className="truncate">{course.title}</span>
    </span>
  );
}

// A soft pill tinted with the course colour, for card headers.
export function CourseTag({ course }: { course: { title: string; color: string } }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-ink"
      style={{ backgroundColor: `color-mix(in srgb, ${course.color} 12%, white)` }}
    >
      <CourseDot color={course.color} />
      <span className="truncate">{course.title}</span>
    </span>
  );
}

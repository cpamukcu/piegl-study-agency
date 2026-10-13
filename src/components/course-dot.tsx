export function CourseDot({ color, size = "sm" }: { color: string; size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${size === "lg" ? "size-4" : "size-2.5"}`}
      style={{ backgroundColor: color }}
    />
  );
}

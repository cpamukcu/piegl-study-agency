import { CourseTag } from "@/components/course-dot";
import { Icon } from "@/components/icons";
import { StatusPill, type Tone } from "@/components/priority-pill";
import type { Course } from "@/db/courses";
import type { Task } from "@/db/tasks";
import { countdownFraction, urgencyLabel, urgencyOf, type Urgency } from "@/lib/day-plan";
import { formatDue } from "@/lib/time";

const LOOK: Record<Urgency, { card: string; tone: Tone; bar: string }> = {
  overdue: { card: "bg-blush/50 ring-coral/30", tone: "coral", bar: "bg-coral" },
  today: { card: "bg-blush/50 ring-coral/25", tone: "coral", bar: "bg-coral" },
  tomorrow: { card: "bg-surface-soft ring-lilac/40", tone: "lavender", bar: "bg-action" },
  week: { card: "bg-surface ring-line/70", tone: "periwinkle", bar: "bg-periwinkle" },
  later: { card: "bg-surface ring-line/70", tone: "sky", bar: "bg-sky" },
};

// A deadline at a glance: course, title, due time, urgency in words, and a one-week countdown line.
export function DeadlineCard({ task, course, now }: { task: Task & { dueAt: number }; course: Course | null; now: number }) {
  const urgency = urgencyOf(task.dueAt, now);
  const look = LOOK[urgency];
  const used = Math.round(countdownFraction(task.dueAt, now) * 100);
  return (
    <article className={`lift flex h-full flex-col rounded-[22px] p-5 shadow-card ring-1 ${look.card}`}>
      <div className="flex items-start justify-between gap-3">
        {course ? <CourseTag course={course} /> : <span className="text-xs font-semibold text-ink-muted">No course</span>}
        <StatusPill tone={look.tone}>{urgencyLabel(task.dueAt, now)}</StatusPill>
      </div>
      <h3 className="mt-3 text-[16px] font-bold leading-snug">{task.title}</h3>
      <p className={`mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold ${urgency === "overdue" || urgency === "today" ? "text-coral-ink" : "text-ink-muted"}`}>
        <Icon name="clock" className="size-3.5" />
        {formatDue(task.dueAt, now)}
      </p>
      <div className="mt-auto pt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className={`h-full rounded-full ${look.bar}`} style={{ width: `${Math.max(used, 4)}%` }} />
        </div>
      </div>
    </article>
  );
}

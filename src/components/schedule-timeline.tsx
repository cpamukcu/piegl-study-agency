import Link from "next/link";
import { CourseBadge } from "@/components/course-dot";
import { Icon, type IconName } from "@/components/icons";
import { StatusPill, type Tone } from "@/components/priority-pill";
import type { Course } from "@/db/courses";
import { clockOf, durationLabel, type TimelineEvent, type TimelineKind, type TimelineStatus } from "@/lib/day-plan";

const KIND: Record<TimelineKind, { label: string; icon: IconName; dot: string; bar: string; chip: string }> = {
  class: { label: "Class", icon: "book", dot: "bg-periwinkle", bar: "bg-periwinkle", chip: "bg-periwinkle-50 text-periwinkle" },
  study: { label: "Planned study", icon: "prepare", dot: "bg-lilac", bar: "bg-lilac", chip: "bg-lavender-50 text-lavender" },
  deadline: { label: "Deadline", icon: "flag", dot: "bg-coral", bar: "bg-coral", chip: "bg-coral-50 text-coral-ink" },
};

const STATUS: Partial<Record<TimelineStatus, { tone: Tone; label: string }>> = {
  now: { tone: "mint", label: "Now" },
  next: { tone: "lavender", label: "Up next" },
  past: { tone: "neutral", label: "Finished" },
  done: { tone: "mint", label: "Done" },
  overdue: { tone: "coral", label: "Overdue" },
};

function EventCard({ event, course }: { event: TimelineEvent; course: Course | null }) {
  const kind = KIND[event.kind];
  const status = STATUS[event.status];
  const emphasis = event.status === "now" || event.status === "next";
  const quiet = event.status === "past" || event.status === "done";
  const title = event.kind === "class" ? (course?.title ?? "Class") : event.title;
  const when =
    event.kind === "class" && event.endsAt !== null
      ? `${clockOf(event.startsAt)}–${clockOf(event.endsAt)} · ${durationLabel(event.startsAt, event.endsAt)}`
      : `Due ${clockOf(event.startsAt)}`;

  const body = (
    <>
      <span aria-hidden="true" className={`absolute inset-y-3 left-0 w-1 rounded-full ${kind.bar} ${quiet ? "opacity-40" : ""}`} />
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${kind.chip}`}>
        <Icon name={kind.icon} className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-[15px] font-semibold ${quiet ? "text-ink-muted" : "text-ink"} ${event.status === "done" ? "line-through" : ""}`}>{title}</span>
          {status && <StatusPill tone={status.tone}>{status.label}</StatusPill>}
        </span>
        <span className="mt-1 block text-[13px] font-medium text-ink-muted">
          <span className="sr-only">{kind.label}, </span>
          {when}
        </span>
        {event.kind === "class" ? (
          event.room && (
            <span className="mt-1 flex items-center gap-1 text-[13px] font-medium text-ink-muted">
              <Icon name="pin" className="size-3.5" />
              {event.room}
            </span>
          )
        ) : (
          course && (
            <span className="mt-1 flex text-[13px] font-medium text-ink-muted">
              <CourseBadge course={course} />
            </span>
          )
        )}
      </span>
    </>
  );

  const cls = `relative flex gap-3 overflow-hidden rounded-[18px] py-3.5 pl-4 pr-4 transition duration-200 ${
    emphasis ? "bg-surface shadow-lift ring-1 ring-lavender/30" : quiet ? "bg-tint ring-1 ring-line" : "bg-surface shadow-card ring-1 ring-line/70"
  }`;

  return course ? (
    <Link href={`/courses/${course.id}`} className={`${cls} lift`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// A vertical day schedule: times on the left, a pale line, and one rounded card per event.
export function ScheduleTimeline({ events, courseById, label }: { events: TimelineEvent[]; courseById: Map<string, Course>; label: string }) {
  return (
    <ol aria-label={label} className="relative space-y-3">
      {events.map((event) => {
        const course = event.courseId ? (courseById.get(event.courseId) ?? null) : null;
        return (
          <li key={event.key} className="relative grid grid-cols-[3.25rem_1fr] gap-3">
            <time className="pt-4 text-right text-[13px] font-semibold tabular-nums text-ink-muted">{clockOf(event.startsAt)}</time>
            <div className="relative pl-5">
              <span aria-hidden="true" className="absolute bottom-[-0.75rem] left-[5px] top-0 w-px bg-line-strong" />
              <span
                aria-hidden="true"
                className={`absolute left-0 top-[1.15rem] size-[11px] rounded-full ring-4 ring-white ${KIND[event.kind].dot} ${
                  event.status === "past" || event.status === "done" ? "opacity-40" : ""
                }`}
              />
              <EventCard event={event} course={course} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

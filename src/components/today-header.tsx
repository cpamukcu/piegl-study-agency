import Link from "next/link";
import { connection } from "next/server";
import { Icon } from "@/components/icons";
import { getDb } from "@/db/connection";
import { isOpen, listTasks } from "@/db/tasks";
import { requestTime } from "@/lib/clock";
import { formatLongDate, greeting } from "@/lib/day-plan";
import { DAY_MS, startOfShanghaiDay } from "@/lib/time";

// The student's first name for the greeting, from STUDENT_NAME in .env.local. Optional.
export function studentName(): string | null {
  const name = process.env.STUDENT_NAME?.trim();
  return name ? name : null;
}

export async function TodayGreeting() {
  await connection();
  const name = studentName();
  return (
    <p className="text-[15px] font-semibold text-ink-muted">
      {greeting(requestTime())}
      {name ? `, ${name}` : ""}
    </p>
  );
}

export function TodayGreetingFallback() {
  return <p className="h-[22px]" aria-hidden="true" />;
}

const ROUND = "inline-flex size-11 items-center justify-center rounded-full bg-surface shadow-card ring-1 ring-line transition duration-200 hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Date pill, deadline bell and profile button for the Today header.
export async function TodayHeaderActions() {
  await connection();
  const now = requestTime();
  const end = startOfShanghaiDay(now) + DAY_MS;
  const attention = listTasks(getDb()).filter((t) => isOpen(t) && t.dueAt !== null && t.dueAt < end).length;
  const name = studentName();

  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex items-center gap-2 rounded-full bg-surface-soft px-3.5 py-2 text-sm font-semibold text-ink ring-1 ring-line">
        <Icon name="timetable" className="size-4 text-lavender" />
        {formatLongDate(now)}
      </span>
      <Link
        href="/deadlines"
        className={`${ROUND} relative text-ink-muted hover:text-accent`}
        aria-label={attention ? `Deadlines: ${attention} due today or overdue` : "Deadlines"}
        title="Deadlines"
      >
        <Icon name="bell" />
        {attention > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-coral-ink px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-white">
            {attention}
          </span>
        )}
      </Link>
      <Link href="/settings" className={`${ROUND} bg-pill text-accent`} aria-label="Profile and settings" title="Profile and settings">
        {name ? <span className="font-display text-sm font-bold">{name.slice(0, 1).toUpperCase()}</span> : <Icon name="profile" />}
      </Link>
    </div>
  );
}

import { connection } from "next/server";
import { EmptyState } from "@/components/empty-state";
import { TaskForm } from "@/components/task-form";
import { TaskSection } from "@/components/task-row";
import { WorkloadChart } from "@/components/workload-chart";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { materializePrepTasks } from "@/db/rules";
import { listTasks } from "@/db/tasks";
import { requestTime } from "@/lib/clock";
import { groupTasks } from "@/lib/deadline-groups";
import { weeklyWorkload } from "@/lib/workload";

export async function DeadlinesData() {
  await connection();
  const db = getDb();
  const now = requestTime();
  materializePrepTasks(db, now);

  const courses = listCourses(db);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const tasks = listTasks(db, { includeDone: true });
  const groups = groupTasks(tasks, now);
  const openCount = groups.overdue.length + groups.thisWeek.length + groups.later.length + groups.noDate.length;
  const sections = [
    { id: "overdue", title: "Overdue", tasks: groups.overdue },
    { id: "this-week", title: "This week", tasks: groups.thisWeek },
    { id: "later", title: "Later", tasks: groups.later },
    { id: "no-date", title: "No date", tasks: groups.noDate },
    { id: "done-recently", title: "Done in the last 7 days", tasks: groups.doneRecently },
  ].filter((s) => s.tasks.length > 0);

  return (
    <div className="space-y-6">
      <TaskForm courses={courses.map((c) => ({ id: c.id, title: c.title }))} />
      {openCount > 0 ? (
        <WorkloadChart weeks={weeklyWorkload(tasks, now)} />
      ) : (
        <EmptyState title="No deadlines yet" art="calendar">Add a task above, or import your ZJU snapshots in Settings.</EmptyState>
      )}
      {sections.map((s) => (
        <TaskSection key={s.id} id={s.id} title={s.title} tasks={s.tasks} courseById={courseById} now={now} />
      ))}
    </div>
  );
}

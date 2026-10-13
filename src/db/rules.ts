import { randomUUID } from "node:crypto";
import { all, one, transaction, type Db } from "@/db/connection";
import { listMeetingTimes } from "@/db/meetings";
import type { Importance } from "@/db/tasks";
import { listTerms } from "@/db/terms";
import { PREP_HORIZON_MS, prepOccurrences } from "@/lib/recurrence";
import { sessionsBetween, type ClassSession } from "@/lib/sessions";

export type RecurrenceRule = {
  id: string;
  courseId: string;
  title: string;
  leadMinutes: number;
  estMinutes: number | null;
  importance: Importance;
  active: boolean;
};

export type RuleInput = { courseId: string; title: string; leadMinutes: number; estMinutes?: number | null; importance?: Importance };

type RuleRow = {
  id: string;
  course_id: string;
  title: string;
  lead_minutes: number;
  est_minutes: number | null;
  importance: Importance;
  active: number;
};

function toRule(r: RuleRow): RecurrenceRule {
  return {
    id: r.id,
    courseId: r.course_id,
    title: r.title,
    leadMinutes: r.lead_minutes,
    estMinutes: r.est_minutes,
    importance: r.importance,
    active: r.active === 1,
  };
}

export function listRules(db: Db, courseId?: string): RecurrenceRule[] {
  const rows = courseId
    ? all<RuleRow>(db, "SELECT * FROM recurrence_rules WHERE course_id = ? ORDER BY title", courseId)
    : all<RuleRow>(db, "SELECT * FROM recurrence_rules ORDER BY title");
  return rows.map(toRule);
}

export function createRule(db: Db, input: RuleInput): RecurrenceRule {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO recurrence_rules (id, course_id, title, lead_minutes, est_minutes, importance) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, input.courseId, input.title, input.leadMinutes, input.estMinutes ?? null, input.importance ?? 2);
  return toRule(one<RuleRow>(db, "SELECT * FROM recurrence_rules WHERE id = ?", id) as RuleRow);
}

export function deleteRule(db: Db, id: string): void {
  db.prepare("DELETE FROM recurrence_rules WHERE id = ?").run(id);
}

// Soft-deletes open prep tasks that no longer make sense: their class has started (so they
// can never become overdue), their routine is gone or paused, or their class time was removed.
function prunePrepTasks(db: Db, now: number, rules: RecurrenceRule[], sessions: ClassSession[]): void {
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const live = new Set(sessions.map((s) => `${s.courseId}:${s.startsAt}`));
  const rows = all<{ id: string; rule_id: string | null; occurrence_key: string | null }>(
    db,
    "SELECT id, rule_id, occurrence_key FROM tasks WHERE source = 'rule' AND deleted_at IS NULL AND status != 'done'",
  );
  const remove = db.prepare("UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?");
  for (const row of rows) {
    const startsAt = Number(row.occurrence_key);
    const rule = row.rule_id ? ruleById.get(row.rule_id) : undefined;
    const started = !(startsAt > now);
    const orphaned = !rule || !live.has(`${rule.courseId}:${startsAt}`);
    if (started || orphaned) remove.run(now, now, row.id);
  }
}

// Brings prep tasks in line with routines and class times for the next two weeks. Safe to call
// on every page load: UNIQUE (rule_id, occurrence_key) makes repeats a no-op.
export function materializePrepTasks(db: Db, now: number): number {
  return transaction(db, () => {
    const rules = listRules(db).filter((r) => r.active);
    const sessions = sessionsBetween(listMeetingTimes(db), listTerms(db), now, now + PREP_HORIZON_MS);
    prunePrepTasks(db, now, rules, sessions);
    if (!rules.length) return 0;
    const insert = db.prepare(
      `INSERT OR IGNORE INTO tasks (id, course_id, type, title, due_at, est_minutes, importance, status, source, rule_id, occurrence_key, created_at, updated_at)
       VALUES (?, ?, 'prep', ?, ?, ?, ?, 'todo', 'rule', ?, ?, ?, ?)`,
    );
    let added = 0;
    for (const rule of rules) {
      for (const occurrence of prepOccurrences(rule, sessions, now)) {
        const result = insert.run(
          randomUUID(),
          rule.courseId,
          occurrence.title,
          occurrence.dueAt,
          rule.estMinutes,
          rule.importance,
          rule.id,
          occurrence.occurrenceKey,
          now,
          now,
        );
        added += Number(result.changes);
      }
    }
    return added;
  });
}

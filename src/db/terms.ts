import { all, type Db } from "@/db/connection";
import { DAY_MS, shanghaiToMs } from "@/lib/time";

export type Period = { period: number; startMinute: number; endMinute: number };

export type Term = { id: string; name: string; startDate: string; weeks: number; periods: Period[] };

type TermRow = { id: string; name: string; start_date: string; weeks: number; periods_json: string };

export function upsertTerm(db: Db, term: Term): void {
  db.prepare(
    `INSERT INTO terms (id, name, start_date, weeks, periods_json) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, start_date = excluded.start_date,
       weeks = excluded.weeks, periods_json = excluded.periods_json`,
  ).run(term.id, term.name, term.startDate, term.weeks, JSON.stringify(term.periods));
}

export function listTerms(db: Db): Term[] {
  return all<TermRow>(db, "SELECT * FROM terms ORDER BY start_date").map((r) => ({
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    weeks: r.weeks,
    periods: JSON.parse(r.periods_json) as Period[],
  }));
}

export function currentTerm(terms: Term[], now: number): Term | null {
  const started = terms
    .filter((t) => shanghaiToMs(t.startDate) <= now)
    .sort((a, b) => shanghaiToMs(b.startDate) - shanghaiToMs(a.startDate));
  const running = started.find((t) => now < shanghaiToMs(t.startDate) + t.weeks * 7 * DAY_MS);
  return running ?? started[0] ?? null;
}

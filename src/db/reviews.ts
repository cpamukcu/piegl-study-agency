// Server-only: one review per week (keyed by that week's Monday); its plan is for the following week.
import { all, one, type Db } from "@/db/connection";
import type { SavedPlanItem } from "@/lib/review";

export type WeeklyReview = {
  weekStart: number;
  wentWell: string | null;
  wasHard: string | null;
  reflection: string | null;
  plan: SavedPlanItem[];
  updatedAt: number;
};

type Row = { week_start: number; went_well: string | null; was_hard: string | null; reflection: string | null; plan_json: string; updated_at: number };

const toReview = (r: Row): WeeklyReview => ({
  weekStart: r.week_start,
  wentWell: r.went_well,
  wasHard: r.was_hard,
  reflection: r.reflection,
  plan: JSON.parse(r.plan_json) as SavedPlanItem[],
  updatedAt: r.updated_at,
});

export function getReview(db: Db, weekStart: number): WeeklyReview | null {
  const row = one<Row>(db, "SELECT * FROM weekly_reviews WHERE week_start = ?", weekStart);
  return row ? toReview(row) : null;
}

export function listReviews(db: Db): WeeklyReview[] {
  return all<Row>(db, "SELECT * FROM weekly_reviews ORDER BY week_start DESC").map(toReview);
}

export function saveReview(db: Db, review: Omit<WeeklyReview, "updatedAt">, now = Date.now()): void {
  db.prepare(
    `INSERT INTO weekly_reviews (week_start, went_well, was_hard, reflection, plan_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(week_start) DO UPDATE SET went_well = excluded.went_well, was_hard = excluded.was_hard,
       reflection = excluded.reflection, plan_json = excluded.plan_json, updated_at = excluded.updated_at`,
  ).run(review.weekStart, review.wentWell, review.wasHard, review.reflection, JSON.stringify(review.plan), now, now);
}

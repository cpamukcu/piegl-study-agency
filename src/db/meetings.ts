import { randomUUID } from "node:crypto";
import { all, one, type Db } from "@/db/connection";

export type MeetingTime = {
  id: string;
  courseId: string;
  termId: string | null;
  weekday: number;
  startMinute: number;
  endMinute: number;
  room: string | null;
  weeks: number[];
  externalId: string | null;
};

export type MeetingInput = {
  courseId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  termId?: string | null;
  room?: string | null;
  weeks?: number[];
  externalId?: string | null;
};

type MeetingRow = {
  id: string;
  course_id: string;
  term_id: string | null;
  weekday: number;
  start_minute: number;
  end_minute: number;
  room: string | null;
  weeks_json: string;
  external_id: string | null;
};

function toMeeting(r: MeetingRow): MeetingTime {
  return {
    id: r.id,
    courseId: r.course_id,
    termId: r.term_id,
    weekday: r.weekday,
    startMinute: r.start_minute,
    endMinute: r.end_minute,
    room: r.room,
    weeks: JSON.parse(r.weeks_json) as number[],
    externalId: r.external_id,
  };
}

export function listMeetingTimes(db: Db, courseId?: string): MeetingTime[] {
  const order = "ORDER BY weekday, start_minute";
  const rows = courseId
    ? all<MeetingRow>(db, `SELECT * FROM meeting_times WHERE course_id = ? ${order}`, courseId)
    : all<MeetingRow>(db, `SELECT * FROM meeting_times ${order}`);
  return rows.map(toMeeting);
}

export function addMeetingTime(db: Db, input: MeetingInput): MeetingTime {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO meeting_times (id, course_id, term_id, weekday, start_minute, end_minute, room, weeks_json, external_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.courseId,
    input.termId ?? null,
    input.weekday,
    input.startMinute,
    input.endMinute,
    input.room ?? null,
    JSON.stringify(input.weeks ?? []),
    input.externalId ?? null,
  );
  return toMeeting(one<MeetingRow>(db, "SELECT * FROM meeting_times WHERE id = ?", id) as MeetingRow);
}

export function deleteMeetingTime(db: Db, id: string): void {
  db.prepare("DELETE FROM meeting_times WHERE id = ?").run(id);
}

export function deleteMeetingTimesByExternalPrefix(db: Db, prefix: string): number {
  const result = db.prepare("DELETE FROM meeting_times WHERE external_id LIKE ? || '%'").run(prefix);
  return Number(result.changes);
}

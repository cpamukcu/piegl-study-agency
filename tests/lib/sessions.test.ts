import { describe, expect, it } from "vitest";
import type { MeetingTime } from "@/db/meetings";
import type { Term } from "@/db/terms";
import { prepOccurrences } from "@/lib/recurrence";
import { compressWeeks, describeMeeting, sessionsBetween, teachingWeek } from "@/lib/sessions";
import { DAY_MS } from "@/lib/time";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-12T04:00:00Z"); // Mon 12 Oct, 12:00 Shanghai (week 5)
const term: Term = { id: "t", name: "T", startDate: "2026-09-14", weeks: 18, periods: [] };

const meeting = (overrides: Partial<MeetingTime>): MeetingTime => ({
  id: "m1",
  courseId: "c1",
  termId: "t",
  weekday: 2,
  startMinute: 530,
  endMinute: 745,
  room: "Hall 1",
  weeks: [1, 3, 5, 7],
  externalId: null,
  ...overrides,
});

describe("teachingWeek", () => {
  it("counts weeks from the Monday of the term's first week", () => {
    expect(teachingWeek(term, NOW)).toBe(5);
    expect(teachingWeek({ startDate: "2026-09-16" }, NOW)).toBe(5);
  });
});

describe("sessionsBetween", () => {
  it("places sessions on the right dates and only in listed weeks", () => {
    const list = sessionsBetween([meeting({})], [term], NOW, NOW + 14 * DAY_MS);
    expect(list).toEqual([
      {
        courseId: "c1",
        meetingTimeId: "m1",
        week: 5,
        startsAt: at("2026-10-13T00:50:00Z"),
        endsAt: at("2026-10-13T04:25:00Z"),
        room: "Hall 1",
      },
    ]);
  });

  it("uses every week of the term when no weeks are listed", () => {
    const list = sessionsBetween([meeting({ weeks: [] })], [term], NOW, NOW + 14 * DAY_MS);
    expect(list.map((s) => s.week)).toEqual([5, 6]);
  });

  it("repeats a class time without a term every week", () => {
    const list = sessionsBetween([meeting({ termId: null, weeks: [] })], [term], NOW, NOW + 14 * DAY_MS);
    expect(list.map((s) => s.startsAt)).toEqual([at("2026-10-13T00:50:00Z"), at("2026-10-20T00:50:00Z")]);
    expect(list[0].week).toBeNull();
  });

  it("sorts sessions from several class times by start", () => {
    const list = sessionsBetween(
      [meeting({ id: "a", weekday: 3, weeks: [5] }), meeting({ id: "b", weekday: 1, startMinute: 900, endMinute: 960, weeks: [6] })],
      [term],
      NOW,
      NOW + 14 * DAY_MS,
    );
    expect(list.map((s) => s.meetingTimeId)).toEqual(["a", "b"]);
  });
});

describe("describing class times", () => {
  it("compresses week lists into ranges", () => {
    expect(compressWeeks([1, 2, 3, 5, 6, 7, 8])).toBe("1–3, 5–8");
    expect(compressWeeks([1, 3, 5, 7])).toBe("1, 3, 5, 7");
    expect(compressWeeks([4])).toBe("4");
    expect(compressWeeks([])).toBe("");
  });

  it("describes a class time in one line", () => {
    expect(describeMeeting(meeting({}))).toBe("Tue 8:50–12:25 · Hall 1 · weeks 1, 3, 5, 7");
    expect(describeMeeting(meeting({ room: null, weeks: [] }))).toBe("Tue 8:50–12:25");
  });
});

describe("prepOccurrences", () => {
  it("creates one prep task per upcoming class, due a set time before it", () => {
    const sessions = sessionsBetween([meeting({ weeks: [5, 6, 7] })], [term], NOW, NOW + 30 * DAY_MS);
    const list = prepOccurrences({ courseId: "c1", title: "Prepare for class", leadMinutes: 12 * 60 }, sessions, NOW);
    expect(list).toEqual([
      { occurrenceKey: String(at("2026-10-13T00:50:00Z")), title: "Prepare for class · Tue 13 Oct", dueAt: at("2026-10-12T12:50:00Z") },
      { occurrenceKey: String(at("2026-10-20T00:50:00Z")), title: "Prepare for class · Tue 20 Oct", dueAt: at("2026-10-19T12:50:00Z") },
    ]);
  });

  it("makes a late prep task due when class starts instead of already overdue", () => {
    const sessions = sessionsBetween([meeting({ weeks: [5] })], [term], NOW, NOW + 7 * DAY_MS);
    const lateEvening = Date.parse("2026-10-12T14:00:00Z"); // Mon 22:00, class Tue 8:50, lead 12 h
    const [occ] = prepOccurrences({ courseId: "c1", title: "Prep", leadMinutes: 12 * 60 }, sessions, lateEvening);
    expect(occ.dueAt).toBe(Date.parse("2026-10-13T00:50:00Z"));
  });

  it("ignores other courses and classes that already started", () => {
    const sessions = sessionsBetween([meeting({ weeks: [5] })], [term], NOW - 7 * DAY_MS, NOW + 7 * DAY_MS);
    expect(prepOccurrences({ courseId: "other", title: "x", leadMinutes: 60 }, sessions, NOW)).toEqual([]);
    expect(prepOccurrences({ courseId: "c1", title: "x", leadMinutes: 60 }, sessions, at("2026-10-13T02:00:00Z"))).toEqual([]);
  });
});

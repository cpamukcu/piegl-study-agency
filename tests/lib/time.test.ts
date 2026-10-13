import { afterEach, describe, expect, it } from "vitest";
import {
  DAY_MS,
  formatClock,
  formatDate,
  formatDue,
  formatMinutes,
  hhmmToMinutes,
  humanDuration,
  parseClock,
  parseLocalDateTime,
  shanghaiParts,
  shanghaiToMs,
  startOfShanghaiDay,
  startOfShanghaiWeek,
  toLocalDateTimeInput,
  weekdayName,
} from "@/lib/time";

const at = (iso: string) => Date.parse(iso);
// Monday 12 Oct 2026, 12:00 in Shanghai.
const NOW = at("2026-10-12T04:00:00Z");

describe("shanghaiParts", () => {
  it("reads an instant as Shanghai wall time", () => {
    expect(shanghaiParts(at("2026-10-12T04:27:00Z"))).toEqual({
      year: 2026,
      month: 10,
      day: 12,
      hour: 12,
      minute: 27,
      weekday: 1,
    });
  });

  it("rolls over to the next Shanghai day after 16:00 UTC", () => {
    expect(shanghaiParts(at("2026-10-18T16:30:00Z"))).toMatchObject({ day: 19, hour: 0, weekday: 1 });
  });
});

describe("day and week starts", () => {
  it("finds Shanghai midnight", () => {
    expect(startOfShanghaiDay(at("2026-10-11T17:00:00Z"))).toBe(at("2026-10-11T16:00:00Z"));
  });

  it("finds Monday 00:00 of the Shanghai week, even late on Sunday", () => {
    expect(startOfShanghaiWeek(at("2026-10-18T15:00:00Z"))).toBe(at("2026-10-11T16:00:00Z"));
    expect(startOfShanghaiWeek(NOW)).toBe(at("2026-10-11T16:00:00Z"));
  });
});

describe("parsing", () => {
  it("turns a Shanghai date and minutes into an instant", () => {
    expect(shanghaiToMs("2026-09-14")).toBe(at("2026-09-13T16:00:00Z"));
    expect(shanghaiToMs("2026-10-13", 530)).toBe(at("2026-10-13T00:50:00Z"));
  });

  it("refuses dates that do not exist", () => {
    expect(() => shanghaiToMs("2026-02-30")).toThrow(/real date/);
    expect(() => shanghaiToMs("13/10/2026")).toThrow(/Not a date/);
  });

  it("parses datetime-local input as Shanghai time", () => {
    expect(parseLocalDateTime("2026-10-19T23:59")).toBe(at("2026-10-19T15:59:00Z"));
    expect(parseLocalDateTime(" 2026-10-19T08:05 ")).toBe(at("2026-10-19T00:05:00Z"));
  });

  it("returns null for bad datetime-local input", () => {
    for (const bad of ["", "2026-10-19", "2026-02-30T10:00", "2026-10-19T24:00", "2026-10-19T10:60", "soon"]) {
      expect(parseLocalDateTime(bad)).toBeNull();
    }
  });

  it("round-trips datetime-local values", () => {
    expect(toLocalDateTimeInput(at("2026-10-19T15:59:00Z"))).toBe("2026-10-19T23:59");
  });

  it("parses and formats clock times", () => {
    expect(parseClock("08:50")).toBe(530);
    expect(parseClock("21:20")).toBe(1280);
    expect(parseClock("25:00")).toBeNull();
    expect(parseClock("")).toBeNull();
    expect(formatClock(530)).toBe("8:50");
    expect(formatClock(1350)).toBe("22:30");
    expect(hhmmToMinutes(850)).toBe(530);
    expect(hhmmToMinutes(2230)).toBe(1350);
  });
});

describe("formatting", () => {
  it("names weekdays and dates", () => {
    expect(weekdayName(1)).toBe("Mon");
    expect(weekdayName(7)).toBe("Sun");
    expect(formatDate(NOW)).toBe("Mon 12 Oct");
  });

  it("describes due times relative to now", () => {
    expect(formatDue(at("2026-10-12T15:59:00Z"), NOW)).toBe("Today 23:59");
    expect(formatDue(at("2026-10-13T04:00:00Z"), NOW)).toBe("Tomorrow 12:00");
    expect(formatDue(at("2026-10-15T14:00:00Z"), NOW)).toBe("Thu 22:00");
    expect(formatDue(at("2026-10-17T05:00:00Z"), NOW)).toBe("Sat 13:00");
    expect(formatDue(at("2026-11-01T11:00:00Z"), NOW)).toBe("Sun 1 Nov, 19:00");
    expect(formatDue(at("2026-10-11T11:00:00Z"), NOW)).toBe("Yesterday 19:00");
    expect(formatDue(at("2026-10-10T11:00:00Z"), NOW)).toBe("Sat 10 Oct, 19:00");
  });

  it("describes durations in plain words", () => {
    expect(humanDuration(45 * 60_000)).toBe("45 min");
    expect(humanDuration(60 * 60_000)).toBe("1 hour");
    expect(humanDuration(5 * 3_600_000)).toBe("5 hours");
    expect(humanDuration(DAY_MS)).toBe("24 hours");
    expect(humanDuration(3 * DAY_MS)).toBe("3 days");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(210)).toBe("3 h 30 min");
  });
});

describe("time zone independence", () => {
  const original = process.env.TZ;

  afterEach(() => {
    process.env.TZ = original;
  });

  it("shows Shanghai time even when the Mac is set to Istanbul", () => {
    process.env.TZ = "Europe/Istanbul";
    expect(formatDue(at("2026-10-19T15:59:00Z"), NOW)).toBe("Mon 19 Oct, 23:59");
    expect(parseLocalDateTime("2026-10-19T23:59")).toBe(at("2026-10-19T15:59:00Z"));
    expect(startOfShanghaiWeek(NOW)).toBe(at("2026-10-11T16:00:00Z"));
  });
});

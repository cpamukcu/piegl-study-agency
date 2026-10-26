// Builds a graduate-system timetable snapshot from the two responses the timetable page uses.
// Field names come from docs/data-sources.md.
import { yjsySnapshotSchema, type YjsySnapshot } from "@/import/schemas";
import { SyncError } from "@/sync/errors";
import { shanghaiParts } from "@/lib/time";

type Obj = Record<string, unknown>;

const obj = (value: unknown): Obj => (value && typeof value === "object" ? (value as Obj) : {});
const list = (value: unknown): Obj[] => (Array.isArray(value) ? value.map(obj) : []);
const text = (value: unknown): string | null => {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
};
const num = (value: unknown): number | null => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

// ZJU wraps payloads in an envelope (`result` in live responses, `data` in some others), so look in all places.
const payload = (raw: unknown): Obj => {
  const top = obj(raw);
  return obj(top.result ?? top.data ?? top);
};

function field(raw: unknown, key: string): unknown {
  const top = obj(raw);
  return top[key] ?? payload(raw)[key];
}

const pad = (n: number) => String(n).padStart(2, "0");

// Accepts "2026-09-14", "2026-09-14 00:00:00", "20260914" or epoch milliseconds.
export function toIsoDate(value: unknown): string | null {
  if (typeof value === "number" && value > 1e11) {
    const p = shanghaiParts(value);
    return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  }
  const s = text(value);
  if (!s) return null;
  const dashed = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  return compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : null;
}

export type YjsyParams = { year: string; termCode: string };

export function buildYjsySnapshot(calendarRaw: unknown, timetableRaw: unknown, params: YjsyParams, now: number): YjsySnapshot {
  const calendar = obj(obj(calendarRaw).kssj !== undefined ? calendarRaw : payload(calendarRaw));
  const start = toIsoDate(calendar.kssj);
  const weeks = num(calendar.zcs);
  if (!start || !weeks) {
    throw new SyncError("The graduate system's term calendar has no start date or week count. ZJU may have changed its format.");
  }
  const periods = list(calendar.sysJxrlSjdList).flatMap((p) => {
    const period = num(p.jc);
    const from = num(p.kssj);
    const to = num(p.jssj);
    return period !== null && from !== null && to !== null ? [{ period, start: from, end: to, part: null }] : [];
  });
  if (periods.length === 0) throw new SyncError("The term calendar lists no class periods.");

  const kcbMap = obj(field(timetableRaw, "kcbMap"));
  const seen = new Set<string>();
  const classes: YjsySnapshot["classes"] = [];
  for (const day of Object.values(kcbMap)) {
    for (const slot of Object.values(obj(day))) {
      for (const e of list(obj(slot).pyKcbjSjddVOList)) {
        const weekday = num(e.xqj);
        const startPeriod = num(e.ksjc);
        const endPeriod = num(e.jsjc);
        const classNo = text(e.bjbh);
        if (weekday === null || startPeriod === null || endPeriod === null || !classNo) continue;
        const entry = {
          course: text(e.kcmc) ?? classNo,
          class_no: classNo,
          teacher: text(e.xm),
          weekday,
          start_period: startPeriod,
          end_period: endPeriod,
          weeks: text(e.zc) ?? "",
          term: text(e.pkxqMc),
          campus: text(e.xqmc),
          building: text(e.jxl),
          room: text(e.cdmc),
        };
        const key = [classNo, weekday, startPeriod, endPeriod, entry.weeks].join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        classes.push(entry);
      }
    }
  }

  const notices = list(field(timetableRaw, "sjddList")).flatMap((n) => {
    const classNo = text(n.bjbh);
    return classNo
      ? [
          {
            course: text(n.kcmc) ?? classNo,
            course_code: null,
            class_no: classNo,
            college: text(n.kkxyMc),
            teacher: text(n.zjjsXm),
            credit: null,
            hours: null,
            term: null,
            note: text(n.bz),
            time_place: null,
            status: text(n.xkzt),
          },
        ]
      : [];
  });

  if (classes.length === 0 && notices.length === 0) {
    throw new SyncError("The graduate system returned an empty timetable. Nothing was saved, so your existing data stays as it is.");
  }

  return yjsySnapshotSchema.parse({
    source: "yjsy.zju.edu.cn",
    fetched_at: new Date(now).toISOString(),
    calendar: {
      year: params.year,
      term_code: params.termCode,
      start,
      end: toIsoDate(calendar.jssj),
      weeks,
      teaching_weeks: num(calendar.pkzcs),
      exam_weeks: num(calendar.kszs),
      periods,
    },
    classes,
    notices,
  });
}

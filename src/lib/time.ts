// All app times are shown in Shanghai time (UTC+8, no daylight saving), whatever
// time zone the Mac is set to. Instants are stored as UTC milliseconds. Only UTC
// Date methods are used here, shifted by the fixed offset.
export const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export type ShanghaiParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function shanghaiParts(ms: number): ShanghaiParts {
  const d = new Date(ms + SHANGHAI_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: ((d.getUTCDay() + 6) % 7) + 1,
  };
}

export function startOfShanghaiDay(ms: number): number {
  return Math.floor((ms + SHANGHAI_OFFSET_MS) / DAY_MS) * DAY_MS - SHANGHAI_OFFSET_MS;
}

export function startOfShanghaiWeek(ms: number): number {
  const day = startOfShanghaiDay(ms);
  return day - (shanghaiParts(day).weekday - 1) * DAY_MS;
}

export function shanghaiToMs(date: string, minutes = 0): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Not a date: "${date}"`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const midnight = Date.UTC(year, month - 1, day) - SHANGHAI_OFFSET_MS;
  const check = shanghaiParts(midnight);
  if (check.year !== year || check.month !== month || check.day !== day) {
    throw new Error(`Not a real date: "${date}"`);
  }
  return midnight + minutes * MINUTE_MS;
}

export function parseLocalDateTime(value: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[2]);
  const minute = Number(m[3]);
  if (hour > 23 || minute > 59) return null;
  try {
    return shanghaiToMs(m[1], hour * 60 + minute);
  } catch {
    return null;
  }
}

export function toLocalDateTimeInput(ms: number): string {
  const p = shanghaiParts(ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function formatClock(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

export function hhmmToMinutes(hhmm: number): number {
  return Math.floor(hhmm / 100) * 60 + (hhmm % 100);
}

export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday - 1] ?? "?";
}

export function formatDate(ms: number): string {
  const p = shanghaiParts(ms);
  return `${WEEKDAYS[p.weekday - 1]} ${p.day} ${MONTHS[p.month - 1]}`;
}

export function formatDue(ms: number, now: number): string {
  const p = shanghaiParts(ms);
  const clock = formatClock(p.hour * 60 + p.minute);
  const days = Math.round((startOfShanghaiDay(ms) - startOfShanghaiDay(now)) / DAY_MS);
  if (days === 0) return `Today ${clock}`;
  if (days === 1) return `Tomorrow ${clock}`;
  if (days === -1) return `Yesterday ${clock}`;
  if (days > 1 && days < 7) return `${WEEKDAYS[p.weekday - 1]} ${clock}`;
  return `${formatDate(ms)}, ${clock}`;
}

export function humanDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE_MS));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) {
    const hours = Math.round(minutes / 60);
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const days = Math.round(minutes / (24 * 60));
  return days === 1 ? "1 day" : `${days} days`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

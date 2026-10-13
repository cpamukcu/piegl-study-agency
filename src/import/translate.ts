// Small, fixed word lists for ZJU data. Unknown words are left as they are.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ImportError } from "@/import/errors";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SEASONS: [RegExp, string][] = [
  [/秋冬/g, " Autumn–Winter"],
  [/春夏/g, " Spring–Summer"],
  [/秋/g, " Autumn"],
  [/冬/g, " Winter"],
  [/春/g, " Spring"],
  [/夏/g, " Summer"],
  [/暑/g, " Summer term"],
  [/短/g, " Short term"],
];

const PLACES: [RegExp, string][] = [
  [/紫金港/g, " Zijingang "],
  [/玉泉/g, " Yuquan "],
  [/西溪/g, " Xixi "],
  [/华家池/g, " Huajiachi "],
  [/之江/g, " Zhijiang "],
  [/海宁/g, " Haining "],
  [/舟山/g, " Zhoushan "],
  [/管理学院/g, " School of Management "],
  [/教学楼/g, " Teaching Building "],
  [/东/g, " East "],
  [/西/g, " West "],
  [/南/g, " South "],
  [/北/g, " North "],
];

const NUMERALS: Record<string, string> = { 一: "1", 二: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8", 九: "9", 十: "10" };

const tidy = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();

export function translateSemester(value: string | null): string | null {
  if (!value) return value;
  let out = value;
  for (const [pattern, english] of SEASONS) out = out.replace(pattern, english);
  return tidy(out).replace(/^(\d{4})-(\d{4})/, "$1–$2");
}

export function translatePlace(value: string | null): string | null {
  if (!value) return value;
  let out = value;
  for (const [pattern, english] of PLACES) out = out.replace(pattern, english);
  out = out.replace(/[一二三四五六七八九十]/g, (n) => NUMERALS[n] ?? n);
  return tidy(out);
}

export function translateNote(value: string | null): string | null {
  if (!value) return value;
  const out = value
    .replace(/(\d{1,2})月(\d{1,2})日/g, (_, m: string, d: string) => `${Number(d)} ${MONTHS[Number(m) - 1] ?? m}`)
    .replace(/(\d{4})级([A-Za-z]*)/g, (_, year: string, group: string) => ` ${year}${group ? ` ${group}` : ""} cohort `)
    .replace(/[（(]/g, " (")
    .replace(/[）)]/g, ") ")
    .replace(/在/g, " in ");
  return translatePlace(out);
}

const ROLES: Record<string, string> = { 外聘专家: "Visiting expert", 助教: "Teaching assistant" };

// People's names are left as written; only role labels are translated.
export function translatePerson(value: string | null): string | null {
  if (!value) return value;
  return ROLES[value.trim()] ?? value;
}

export const COURSE_NAMES_FILE = "course-names.json";

const namesSchema = z.record(z.string(), z.string());

export function loadCourseNames(dir: string): Record<string, string> {
  const file = path.join(dir, COURSE_NAMES_FILE);
  if (!existsSync(file)) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new ImportError(`${COURSE_NAMES_FILE} is not valid JSON.`);
  }
  const parsed = namesSchema.safeParse(raw);
  if (!parsed.success) throw new ImportError(`${COURSE_NAMES_FILE} must map each ZJU course title to an English title.`);
  return parsed.data;
}

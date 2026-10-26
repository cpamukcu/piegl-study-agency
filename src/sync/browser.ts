// Drives a dedicated Chrome profile (never your everyday one) to read ZJU as you. Read-only GETs only.
// The ZJU password is never seen or stored; the owner logs in by hand in a visible window.
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page, type Request } from "playwright";
import { NeedsLoginError, SyncError } from "@/sync/errors";
import { fetchTronclassSnapshot, type GetJson } from "@/sync/tronclass";
import { buildYjsySnapshot } from "@/sync/yjsy";
import type { TronclassSnapshot, YjsySnapshot } from "@/import/schemas";
import { shanghaiParts } from "@/lib/time";

const COURSES = "https://courses.zju.edu.cn";
const YJSY = "https://yjsy.zju.edu.cn";
const TIMETABLE_PAGE = `${YJSY}/dashboard/workplace?dm=py_grkb`;
const SESSION_FILE = "zju-session.json";
const REQUEST_GAP_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const onLoginPage = (url: string) => new URL(url).hostname === "zjuam.zju.edu.cn";

export type BrowserOptions = { dataDir: string; headless: boolean };

// Chrome drops session cookies when it closes, so the login is also kept in a private file
// and put back on the next run. "Forget ZJU session" deletes both this file and the profile.
async function restoreSession(context: BrowserContext, dataDir: string): Promise<void> {
  const file = path.join(dataDir, SESSION_FILE);
  if (!existsSync(file)) return;
  try {
    const state = JSON.parse(readFileSync(file, "utf8")) as { cookies?: Parameters<BrowserContext["addCookies"]>[0] };
    if (state.cookies?.length) await context.addCookies(state.cookies);
  } catch {
    // A damaged file just means the owner logs in again.
  }
}

async function saveSession(context: BrowserContext, dataDir: string): Promise<void> {
  const file = path.join(dataDir, SESSION_FILE);
  const tmp = `${file}.tmp`;
  const state = await context.storageState();
  writeFileSync(tmp, JSON.stringify({ cookies: state.cookies }), { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, file);
}

async function launch({ dataDir, headless }: BrowserOptions): Promise<BrowserContext> {
  const profile = path.join(dataDir, "browser-profile");
  mkdirSync(profile, { recursive: true, mode: 0o700 });
  const channel = process.env.SYNC_BROWSER ?? "chrome"; // "chromium" uses Playwright's own build
  const base = { headless, viewport: { width: 1280, height: 900 }, locale: "zh-CN", timezoneId: "Asia/Shanghai" };
  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(profile, channel === "chromium" ? base : { ...base, channel });
  } catch (error) {
    if (channel === "chromium") throw error;
    context = await chromium.launchPersistentContext(profile, base);
  }
  await restoreSession(context, dataDir);
  return context;
}

// Runs fetch() inside the page so the request carries the page's own cookies.
function pageFetcher(page: Page): GetJson {
  return async (urlPath) => {
    await sleep(REQUEST_GAP_MS);
    const result = await page.evaluate(async (u) => {
      try {
        const r = await fetch(u, { credentials: "same-origin", headers: { Accept: "application/json" } });
        return { status: r.status, body: await r.text() };
      } catch {
        return { status: 0, body: "" };
      }
    }, urlPath);
    if (result.status === 401 || result.status === 403 || result.status === 0) throw new NeedsLoginError("ZJU asked for a new login.");
    if (result.status >= 400) throw new SyncError(`ZJU answered ${result.status} for ${urlPath.split("?")[0]}.`);
    try {
      return JSON.parse(result.body);
    } catch {
      throw new NeedsLoginError("ZJU sent a login page instead of data.");
    }
  };
}

async function openCourses(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(COURSES, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  if (onLoginPage(page.url())) throw new NeedsLoginError("Courses@ZJU redirected to the ZJU login page.");
  return page;
}

// The timetable API wants the page's own session token, so the page makes the timetable request itself
// and we read its response. The token is used in memory for one more request and never saved.
function termCodeFor(now: number, override: string | undefined): string {
  if (override) return override;
  const month = shanghaiParts(now).month;
  if (month >= 9 || month === 1) return "12"; // autumn–winter term, per docs/data-sources.md
  throw new SyncError("Set ZJU_YJSY_XQ in .env.local to the term code for this semester (see docs/data-sources.md).");
}

async function fetchTimetable(context: BrowserContext, now: number): Promise<YjsySnapshot> {
  const page = await context.newPage();
  let timetableRequest: Request | null = null;
  page.on("request", (req) => {
    if (req.url().includes("/dataapi/py/pyKcbj/queryXskbByLoginUser")) timetableRequest = req;
  });
  const timetable = page.waitForResponse((r) => r.url().includes("/dataapi/py/pyKcbj/queryXskbByLoginUser"), { timeout: 40_000 });
  await page.goto(TIMETABLE_PAGE, { waitUntil: "domcontentloaded", timeout: 45_000 });
  if (onLoginPage(page.url())) throw new NeedsLoginError("The graduate system redirected to the ZJU login page.");
  let response;
  try {
    response = await timetable;
  } catch {
    if (onLoginPage(page.url())) throw new NeedsLoginError("The graduate system redirected to the ZJU login page.");
    throw new SyncError("The graduate system timetable page made no timetable request. ZJU may have changed the page.");
  }
  if (response.status() === 401 || response.status() === 403) throw new NeedsLoginError("The graduate system asked for a new login.");
  const timetableJson: unknown = await response.json();

  const query = new URL(response.url()).searchParams;
  const year = query.get("xn");
  if (!year) throw new SyncError("The timetable request had no school-year (xn) value.");
  const termCode = termCodeFor(now, process.env.ZJU_YJSY_XQ);

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries((timetableRequest as Request | null)?.headers() ?? {})) {
    if (!["cookie", "host", "content-length"].includes(name) && !name.startsWith(":")) headers[name] = value;
  }
  const calendarUrl = `${YJSY}/dataapi/system/sysJxrlXqsj/getJxrlByXnxq?xn=${year}&xq=${termCode}&sfqr=1`;
  const calendarResponse = await context.request.get(calendarUrl, { headers });
  if (!calendarResponse.ok()) throw new SyncError(`The term calendar request failed (${calendarResponse.status()}).`);
  const calendarJson: unknown = await calendarResponse.json();
  await page.close();
  return buildYjsySnapshot(calendarJson, timetableJson, { year, termCode }, now);
}

export type FetchedSnapshots = { tronclass: TronclassSnapshot; yjsy: YjsySnapshot };

export async function fetchAll(options: BrowserOptions, now: number): Promise<FetchedSnapshots> {
  const context = await launch(options);
  try {
    const coursesPage = await openCourses(context);
    const tronclass = await fetchTronclassSnapshot(pageFetcher(coursesPage), now);
    const yjsy = await fetchTimetable(context, now);
    await saveSession(context, options.dataDir);
    return { tronclass, yjsy };
  } finally {
    await context.close();
  }
}

// Opens a visible window so the owner can log in to ZJU single sign-on by hand.
export async function interactiveLogin(options: Omit<BrowserOptions, "headless">): Promise<void> {
  const context = await launch({ ...options, headless: false });
  try {
    const page = await context.newPage();
    await page.goto(COURSES, { waitUntil: "domcontentloaded", timeout: 45_000 });
    console.log("Log in to ZJU in the browser window. This closes by itself once you are in.");
    await page.waitForURL((url) => url.hostname === "courses.zju.edu.cn" && !url.pathname.startsWith("/login"), { timeout: 10 * 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    const grad = await context.newPage();
    await grad.goto(TIMETABLE_PAGE, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await grad.waitForURL((url) => url.hostname === "yjsy.zju.edu.cn", { timeout: 60_000 });
    await grad.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await saveSession(context, options.dataDir);
  } finally {
    await context.close();
  }
}

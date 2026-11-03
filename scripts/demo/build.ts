// Builds the public, read-only demo for GitHub Pages: fake data, a production build under /<repo>,
// every page reachable from Today saved as static HTML, plus a small script that keeps links and forms working.
//
//   npm run demo -- <output folder>
//
// Then publish the folder to the gh-pages branch (see README). No real data is involved: the database is
// created from scripts/demo/seed.ts in a temporary folder and deleted afterwards.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = process.env.DEMO_BASE_PATH ?? "/piegl-study-agency";
const PORT = 3199;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MAX_PAGES = 300;
const REPO_URL = "github.com/cpamukcu/piegl-study-agency";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Must match keyOf in client.js: path without base or trailing slash, query sorted.
function appKey(u: URL): { path: string; query: string; key: string } {
  let p = u.pathname.startsWith(BASE) ? u.pathname.slice(BASE.length) : u.pathname;
  p = p.replace(/\/index\.html$/, "").replace(/\/$/, "") || "/today";
  const params = [...u.searchParams.entries()].sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0));
  const query = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return { path: p, query, key: query ? `${p}?${query}` : p };
}

// FNV-1a: short, stable folder names for pages that differ only by their query.
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const folderFor = (k: { path: string; query: string }) => (k.query ? `${k.path}/_q-${hash(k.query)}` : k.path);

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): number {
  return spawnSync(cmd, args, { stdio: "inherit", env }).status ?? 1;
}

async function waitForServer(server: ChildProcess): Promise<void> {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error("The demo server stopped while starting.");
    try {
      const res = await fetch(`${ORIGIN}${BASE}/today`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  throw new Error("The demo server did not start within a minute.");
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

function linksIn(html: string): string[] {
  return [...html.matchAll(/\shref="([^"]+)"/g)].map((m) => decode(m[1]));
}

async function main(): Promise<void> {
  const out = path.resolve(process.argv[2] ?? "demo-site");
  const repo = process.cwd();
  const inRepo = out === repo || out.startsWith(repo + path.sep);
  if (inRepo && !out.startsWith(path.join(repo, "out") + path.sep)) {
    throw new Error("Write the demo outside the repository, or under ./out/ (which git ignores).");
  }

  // 1. Fake data in a throwaway folder.
  const dataDir = mkdtempSync(path.join(tmpdir(), "piegl-demo-"));
  process.env.DATA_DIR = dataDir;
  const now = Date.now();
  const { getDb } = await import("@/db/connection");
  const { seedDemo } = await import("./seed");
  const db = getDb();
  await seedDemo(db, dataDir, now);
  const materials = db.prepare("SELECT id, course_id, file_name, extraction FROM materials").all() as { id: string; course_id: string; file_name: string; extraction: string }[];
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATA_DIR: dataDir,
    DEMO_BASE_PATH: BASE,
    NEXT_TELEMETRY_DISABLED: "1",
    // Turns the AI screens on for display. The demo never submits a form, so this key is never sent anywhere.
    ANTHROPIC_API_KEY: "demo-key-not-used",
    ANTHROPIC_MODEL: "claude-sonnet-5-5",
    STUDENT_NAME: "",
    SYNC_MATERIALS: "1",
  };

  // 2. Production build under the base path. (Next 16.4.0 may stop once to print an upgrade notice; a second run continues.)
  if (run("npx", ["next", "build"], env) !== 0 && run("npx", ["next", "build"], env) !== 0) throw new Error("next build failed");

  // Its own process group, so stopping it also stops the Node process npx starts.
  const server = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(PORT)], { env, stdio: ["ignore", "inherit", "inherit"], detached: true });
  try {
    await waitForServer(server);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });

    // 3. Crawl from Today, following every link inside the app. Seed the URLs only a form can reach.
    const queue: string[] = ["/today", "/prepare"];
    const aliases: Record<string, string> = {};
    const byCourse = new Map<string, string[]>();
    for (const m of materials) if (m.extraction === "ok") byCourse.set(m.course_id, [...(byCourse.get(m.course_id) ?? []), m.id]);
    for (const [courseId, ids] of byCourse) {
      const all = `/prepare?course=${courseId}&${ids.map((id) => `m=${id}`).join("&")}`;
      queue.push(`/prepare?course=${courseId}`, all);
      aliases[`/prepare?course=${encodeURIComponent(courseId)}&all=1`] = appKey(new URL(all, ORIGIN)).key;
    }

    // The timetable's previous/next links go on forever; keep last week to next week.
    const DAY = 24 * 60 * 60 * 1000;
    const dayKey = (ms: number) => new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const firstDay = dayKey(now - 7 * DAY - ((new Date(now + 8 * 60 * 60 * 1000).getUTCDay() + 6) % 7) * DAY);
    const lastDay = dayKey(now + 14 * DAY);
    const wanted = (u: URL) => {
      const day = u.searchParams.get("day");
      return !day || (day >= firstDay && day <= lastDay);
    };

    const pages: Record<string, string> = {};
    const htmlByKey = new Map<string, string>();
    const assets = new Set<string>();
    const seen = new Set<string>();
    while (queue.length && seen.size < MAX_PAGES) {
      const k = appKey(new URL(queue.shift() as string, ORIGIN));
      if (seen.has(k.key)) continue;
      seen.add(k.key);
      const res = await fetch(`${ORIGIN}${BASE}${k.key}`, { redirect: "manual" });
      if (res.status !== 200) {
        console.warn(`skip ${k.key}: ${res.status}`);
        continue;
      }
      const html = await res.text();
      htmlByKey.set(k.key, html);
      pages[k.key] = `${BASE}${folderFor(k)}/`;
      for (const href of linksIn(html)) {
        const u = new URL(href, `${ORIGIN}${BASE}${k.path}`);
        if (u.origin !== ORIGIN) continue;
        const p = u.pathname.startsWith(BASE) ? u.pathname.slice(BASE.length) : u.pathname;
        if (p.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(p)) {
          assets.add(p);
          continue;
        }
        if (/^\/materials\/[^/]+\/file$/.test(p) || p === "/" || p === "" || !wanted(u)) continue;
        queue.push(p + u.search);
      }
    }
    for (const [alias, key] of Object.entries(aliases)) if (pages[key]) pages[alias] = pages[key];

    // 4. Original course files, saved with their extension so the browser opens PDFs inline.
    const files: Record<string, string> = {};
    for (const m of materials) {
      const res = await fetch(`${ORIGIN}${BASE}/materials/${m.id}/file`);
      if (!res.ok) continue;
      const ext = path.extname(m.file_name).toLowerCase() || ".bin";
      mkdirSync(path.join(out, "materials", m.id), { recursive: true });
      writeFileSync(path.join(out, "materials", m.id, `file${ext}`), new Uint8Array(await res.arrayBuffer()));
      files[`/materials/${m.id}/file`] = `${BASE}/materials/${m.id}/file${ext}`;
    }

    // 5. Write pages with the demo banner and script, and links fixed to the base path.
    const built = new Date(now).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Shanghai" });
    const head = `<style>
body::before{content:'Read-only demo with fake sample data, built ${built}. Nothing is saved or sent; the Focus dial works. Code: ${REPO_URL}';display:block;position:sticky;top:0;z-index:60;background:#f8f6ff;color:#302a52;border-bottom:1px solid #e4e2ef;font:500 13px/1.45 -apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif;padding:8px 16px;text-align:center}
#demo-toast{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:70;background:#302a52;color:#fff;font:600 13px/1.4 -apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif;padding:10px 16px;border-radius:14px;box-shadow:0 12px 30px rgba(73,58,126,.25);max-width:min(92vw,360px);text-align:center;opacity:0;transition:opacity .2s;pointer-events:none}
#demo-toast.show{opacity:1}
@media (min-width:768px){#demo-toast{bottom:32px}}
</style>
<script src="${BASE}/demo-data.js"></script>
<script src="${BASE}/demo.js"></script>`;
    const escaped = BASE.replace(/[/]/g, "\\/");
    const fixLinks = new RegExp(`(\\s(?:href|action))="\\/(?!\\/)(?!${escaped.slice(2)}\\/)`, "g");
    for (const [key, html] of htmlByKey) {
      const page = html
        .replaceAll(dataDir, "~/PIEGL-data")
        .replace(fixLinks, `$1="${BASE}/`)
        .replace(/<head>/, `<head>\n${head}\n`);
      const folder = path.join(out, folderFor(appKey(new URL(key, ORIGIN))));
      mkdirSync(folder, { recursive: true });
      writeFileSync(path.join(folder, "index.html"), page);
    }
    writeFileSync(path.join(out, "demo-data.js"), `window.__DEMO__=${JSON.stringify({ base: BASE, pages, files })};\n`);
    cpSync(path.join(repo, "scripts", "demo", "client.js"), path.join(out, "demo.js"));
    cpSync(path.join(repo, ".next", "static"), path.join(out, "_next", "static"), { recursive: true });
    for (const asset of assets) {
      if (asset.startsWith("/_next/static/")) continue;
      const res = await fetch(`${ORIGIN}${BASE}${asset}`);
      if (!res.ok) continue;
      mkdirSync(path.dirname(path.join(out, asset)), { recursive: true });
      writeFileSync(path.join(out, asset), new Uint8Array(await res.arrayBuffer()));
    }
    cpSync(path.join(out, "today", "index.html"), path.join(out, "404.html"));
    writeFileSync(path.join(out, "index.html"), `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${BASE}/today/"><title>PIEGL Study Agency</title><a href="${BASE}/today/">Open the demo</a>\n`);
    writeFileSync(path.join(out, ".nojekyll"), "");
    console.log(`Demo written to ${out}: ${htmlByKey.size} pages, ${Object.keys(files).length} files.`);
  } finally {
    if (server.pid) process.kill(-server.pid, "SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
    console.log("Note: .next now holds the demo build. Run `npm run build` again before `npm start`.");
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);

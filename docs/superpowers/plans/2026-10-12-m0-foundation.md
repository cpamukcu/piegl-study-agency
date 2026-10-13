# M0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private, runnable app shell for PIEGL Study Agency: 8 calm, empty screens, an academic-integrity note, a safe `.gitignore`, a data folder kept outside the repo, docs, and a push to a private GitHub repo.

**Architecture:** Next.js App Router project in `~/PIEGL/study-agency`. The dev and prod servers bind to `127.0.0.1:3100` only. One server-side module (`src/lib/data-dir.ts`) decides where private data lives and refuses any path inside the repo. UI is plain Tailwind with design tokens on `:root` (light and dark). No database, AI, or sync yet.

**Tech Stack:** Node 24, npm 11, Next.js 16.4 (via `create-next-app@16.4.0`), React 19, Tailwind CSS 4, Vitest 5 + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-12-piegl-study-agency-design.md`

**Change from spec:** the spec lists "demo data" under M0. Demo data needs the database schema, which arrives in M1, so the demo seed moves to M1. M0 ships no data at all.

## Global Constraints

- Server binds to `127.0.0.1` only, port `3100`, for both `dev` and `start`.
- Private data lives in `DATA_DIR`, default `~/PIEGL-data`, never inside the repo.
- No real ZJU material, credentials, cookies, API keys, or personal data in the repo. Sample data is fake only.
- `.env.example` has blank or default values only. Real values go in `.env.local`, which is gitignored.
- English UI, short plain words.
- Calm academic look: no gamification, no clutter. System font stacks only (no font downloads at build time). Light and dark themes.
- Keyboard-friendly: visible focus rings, a skip link, `aria-current` on the active nav item.
- No shadcn/ui, Drizzle, or Playwright in M0. They arrive with the milestones that need them (M1, M1, M3).
- Small commits. Every commit message ends with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. `DATA_DIR` set to a path inside the repo (e.g. `./data`, `~/PIEGL/study-agency/data`): the app must refuse it with a clear message, not write into the repo. Pinned in Task 3.
2. `DATA_DIR` unset or starting with `~`: must expand to the home folder, never create a literal `~` folder. Pinned in Task 3.
3. macOS is case-insensitive: `/Users/x/piegl/STUDY-AGENCY/data` is still inside the repo. Pinned in Task 3.
4. Course files with upper-case extensions (`Slides.PDF`, `Week3.PPTX`) must be ignored by git just like lower-case ones. Pinned in Task 2.
5. Browser storage blocked (private window, cleared site data): the integrity banner must still render, dismiss, and never crash the page. Pinned in Task 6.

---

### Task 1: Scaffold Next.js, bind to localhost, set up Vitest

**Files:**
- Create (generated): `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/favicon.ico`, `.gitignore`, `README.md`
- Create: `vitest.config.mts`, `tests/setup.ts`
- Test: `tests/server-binding.test.ts`
- Delete: `public/*.svg` (template images)

**Interfaces:**
- Consumes: nothing.
- Produces: npm scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `check`. Vitest runs every `tests/**/*.test.ts(x)` with the `@/` alias pointing to `src/`. Component tests opt into jsdom with a `// @vitest-environment jsdom` first line.

- [ ] **Step 1: Generate the app in a temp folder and copy it in**

The repo already has `docs/` and `.git/`, so generate elsewhere and copy:

```bash
SCAFFOLD="$(mktemp -d)"
npx --yes create-next-app@16.4.0 "$SCAFFOLD/study-agency" --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --disable-git --yes
rsync -a --exclude .git --exclude node_modules "$SCAFFOLD/study-agency/" ~/PIEGL/study-agency/
cd ~/PIEGL/study-agency && npm install
rm -f public/*.svg
```

Expected: `npm install` finishes with no errors. `ls` shows `package.json`, `src/app/`, `docs/`.

- [ ] **Step 2: Install test tools**

```bash
npm install -D vitest@5.0.3 @vitejs/plugin-react@6.1.2 jsdom@30.1.2 @testing-library/react@16.3.3 @testing-library/dom @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Add Vitest config and setup**

`vitest.config.mts`:

```ts
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
  },
});
```

`tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 4: Write the failing test**

`tests/server-binding.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import pkg from "../package.json";

const scripts = pkg.scripts as Record<string, string>;

describe("server binding", () => {
  it.each(["dev", "start"])("%s listens on 127.0.0.1 only", (name) => {
    expect(scripts[name]).toMatch(/(?:-H|--hostname) 127\.0\.0\.1(?:\s|$)/);
  });

  it.each(["dev", "start"])("%s uses port 3100", (name) => {
    expect(scripts[name]).toMatch(/(?:-p|--port) 3100(?:\s|$)/);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run tests/server-binding.test.ts`
Expected: FAIL. The generated `dev` script is plain `next dev`.

- [ ] **Step 6: Set the scripts**

In `package.json`, replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "next dev -H 127.0.0.1 -p 3100",
  "build": "next build",
  "start": "next start -H 127.0.0.1 -p 3100",
  "lint": "eslint",
  "typecheck": "next typegen && tsc --noEmit",
  "test": "vitest run",
  "check": "npm run lint && npm run typecheck && npm test"
}
```

- [ ] **Step 7: Run the checks**

Run: `npm run check`
Expected: lint clean, typecheck clean, 4 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git status --short   # confirm: no node_modules, no .next, no .env files
git commit -m "Scaffold Next.js app bound to 127.0.0.1:3100 with Vitest" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Harden `.gitignore` with a test

**Files:**
- Modify: `.gitignore` (full replace)
- Test: `tests/gitignore.test.ts`

**Interfaces:**
- Consumes: a git repo at the project root (tests run with cwd = repo root).
- Produces: a test that fails whenever a private-data pattern stops being ignored or an ignored file gets tracked.

- [ ] **Step 1: Write the failing test**

`tests/gitignore.test.ts`:

```ts
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function isIgnored(path: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "--quiet", "--no-index", path], { stdio: "ignore" });
    return true;
  } catch (error) {
    if ((error as { status?: number }).status === 1) return false;
    throw error;
  }
}

const MUST_IGNORE = [
  ".env",
  ".env.local",
  ".env.production",
  "data/study.db",
  "uploads/week1.pdf",
  "extracted/week1.txt",
  "sessions/zju.json",
  "playwright/.auth/state.json",
  "study.db",
  "study.db-wal",
  "study.sqlite",
  "study.sqlite-shm",
  "logs/sync.txt",
  "sync.log",
  "slides.pdf",
  "Slides.PDF",
  "deck.ppt",
  "deck.pptx",
  "Week3.PPTX",
  "reading.docx",
  "Reading.DOCX",
  "private.key",
  "cert.pem",
  ".DS_Store",
  "coverage/index.html",
  "node_modules/next/package.json",
  ".next/cache/x",
  ".claude/settings.local.json",
];

const MUST_KEEP = [
  ".env.example",
  ".gitignore",
  "package.json",
  "README.md",
  "src/app/page.tsx",
  "docs/PRIVACY.md",
  "tests/gitignore.test.ts",
];

describe(".gitignore", () => {
  it.each(MUST_IGNORE)("ignores %s", (path) => {
    expect(isIgnored(path)).toBe(true);
  });

  it.each(MUST_KEEP)("keeps %s", (path) => {
    expect(isIgnored(path)).toBe(false);
  });

  it("has no ignored files already tracked", () => {
    const tracked = execFileSync("git", ["ls-files", "--cached", "--ignored", "--exclude-standard"], {
      encoding: "utf8",
    });
    expect(tracked.trim()).toBe("");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/gitignore.test.ts`
Expected: FAIL on course-file and data rows (e.g. `slides.pdf`, `data/study.db`). The generated `.gitignore` does not cover them.

- [ ] **Step 3: Replace `.gitignore`**

```gitignore
# Dependencies and build output
node_modules/
.next/
out/
build/
coverage/
next-env.d.ts
*.tsbuildinfo

# Secrets: never commit
.env
.env.*
!.env.example
*.pem
*.key
*.KEY

# Private study data: never commit.
# Real data lives in DATA_DIR (default ~/PIEGL-data), outside this repo.
data/
uploads/
extracted/
sessions/
playwright/.auth/
*.db
*.db-*
*.sqlite
*.sqlite-*
*.sqlite3

# Course files
*.pdf
*.PDF
*.ppt
*.pptx
*.PPT
*.PPTX
*.doc
*.docx
*.DOC
*.DOCX

# Logs
logs/
*.log
npm-debug.log*

# OS, editor, local tool config
.DS_Store
.vscode/
.idea/
.claude/
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/gitignore.test.ts`
Expected: PASS (all rows).

- [ ] **Step 5: Commit**

```bash
git add .gitignore tests/gitignore.test.ts
git commit -m "Ignore secrets, study data and course files, with a guard test" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Data folder outside the repo

**Files:**
- Create: `src/lib/data-dir.ts`, `.env.example`
- Test: `tests/data-dir.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (server-only module, uses `node:fs`; never import it from a `"use client"` file):
  - `DEFAULT_DATA_DIR: "~/PIEGL-data"`
  - `class DataDirError extends Error`
  - `resolveDataDir(raw: string | undefined, options: { repoRoot: string; home?: string; caseInsensitive?: boolean }): string` returns an absolute path or throws `DataDirError`
  - `getDataDir(): string` is `resolveDataDir(process.env.DATA_DIR, { repoRoot: process.cwd() })`
  - `ensureDataDir(dir: string): string` creates the folder (mode `0o700`) if missing and returns it

- [ ] **Step 1: Write the failing test**

`tests/data-dir.test.ts`:

```ts
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DataDirError, ensureDataDir, resolveDataDir } from "@/lib/data-dir";

const repoRoot = "/work/study-agency";
const home = "/Users/student";
const base = { repoRoot, home, caseInsensitive: false };

describe("resolveDataDir", () => {
  it("defaults to ~/PIEGL-data", () => {
    expect(resolveDataDir(undefined, base)).toBe("/Users/student/PIEGL-data");
    expect(resolveDataDir("   ", base)).toBe("/Users/student/PIEGL-data");
  });

  it("expands ~ and ~/", () => {
    expect(resolveDataDir("~", base)).toBe("/Users/student");
    expect(resolveDataDir("~/Study/data", base)).toBe("/Users/student/Study/data");
  });

  it("accepts absolute paths outside the repo", () => {
    expect(resolveDataDir("/Volumes/USB/piegl", base)).toBe("/Volumes/USB/piegl");
  });

  it("accepts a sibling folder whose name starts like the repo", () => {
    expect(resolveDataDir("/work/study-agency-data", base)).toBe("/work/study-agency-data");
  });

  it("rejects relative paths", () => {
    expect(() => resolveDataDir("./data", base)).toThrow(DataDirError);
    expect(() => resolveDataDir("data", base)).toThrow(/absolute path/);
  });

  it("rejects the repo itself and anything inside it", () => {
    expect(() => resolveDataDir("/work/study-agency", base)).toThrow(DataDirError);
    expect(() => resolveDataDir("/work/study-agency/data", base)).toThrow(/outside the repository/);
    expect(() => resolveDataDir("/work/study-agency/../study-agency/data", base)).toThrow(DataDirError);
  });

  it("rejects a folder inside the repo named like '..x'", () => {
    expect(() => resolveDataDir("/work/study-agency/..x", base)).toThrow(DataDirError);
  });

  it("treats paths case-insensitively when asked (macOS)", () => {
    const mac = { ...base, caseInsensitive: true };
    expect(() => resolveDataDir("/WORK/Study-Agency/data", mac)).toThrow(DataDirError);
    expect(resolveDataDir("/WORK/Study-Agency/data", base)).toBe("/WORK/Study-Agency/data");
  });
});

describe("ensureDataDir", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it("creates a private nested folder and returns it", () => {
    root = mkdtempSync(path.join(tmpdir(), "psa-"));
    const dir = path.join(root, "a", "b");
    expect(ensureDataDir(dir)).toBe(dir);
    expect(statSync(dir).isDirectory()).toBe(true);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
  });

  it("is fine when the folder already exists", () => {
    root = mkdtempSync(path.join(tmpdir(), "psa-"));
    expect(ensureDataDir(root)).toBe(root);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/data-dir.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/data-dir".

- [ ] **Step 3: Implement**

`src/lib/data-dir.ts`:

```ts
// Server-only: decides where private study data lives. Never import from a client component.
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const DEFAULT_DATA_DIR = "~/PIEGL-data";

export class DataDirError extends Error {
  name = "DataDirError";
}

type ResolveOptions = {
  repoRoot: string;
  home?: string;
  caseInsensitive?: boolean;
};

function expandHome(value: string, home: string): string {
  if (value === "~") return home;
  if (value.startsWith("~/")) return path.join(home, value.slice(2));
  return value;
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  if (rel === "") return true;
  return !(rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel));
}

export function resolveDataDir(raw: string | undefined, options: ResolveOptions): string {
  const { repoRoot, home = homedir(), caseInsensitive = process.platform === "darwin" } = options;
  const value = raw?.trim() || DEFAULT_DATA_DIR;
  const expanded = expandHome(value, home);

  if (!path.isAbsolute(expanded)) {
    throw new DataDirError(`DATA_DIR must be an absolute path or start with ~/ (got "${value}").`);
  }

  const resolved = path.resolve(expanded);
  const root = path.resolve(repoRoot);
  const fold = (p: string) => (caseInsensitive ? p.toLowerCase() : p);

  if (isInside(fold(resolved), fold(root))) {
    throw new DataDirError(`DATA_DIR must be outside the repository (${root}). Got ${resolved}.`);
  }
  return resolved;
}

export function getDataDir(): string {
  return resolveDataDir(process.env.DATA_DIR, { repoRoot: process.cwd() });
}

export function ensureDataDir(dir: string): string {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
```

`.env.example`:

```bash
# Copy this file to .env.local and fill it in. Never commit .env.local.

# Where private study data lives: database, course files, extracted text,
# ZJU login session, logs. Must be outside this repository.
DATA_DIR=~/PIEGL-data

# Claude API, used from milestone M4. Leave blank to run with AI turned off.
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5-5
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/data-dir.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-dir.ts tests/data-dir.test.ts .env.example
git commit -m "Keep private data in DATA_DIR outside the repo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Calm app shell and main navigation

**Files:**
- Create: `src/lib/nav.ts`, `src/components/nav.tsx`
- Modify: `src/app/globals.css` (full replace), `src/app/layout.tsx` (full replace), `src/app/page.tsx` (full replace)
- Test: `tests/nav.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type NavItem = { href: string; label: string }`
  - `NAV_ITEMS: readonly NavItem[]` in this order: `/today` Today, `/courses` Courses, `/deadlines` Deadlines, `/prepare` Prepare Class, `/research` Research, `/practice` Practice, `/review` Weekly Review, `/settings` Settings
  - `isActive(pathname: string, href: string): boolean`
  - `<Nav />` client component
  - Tailwind color tokens: `paper`, `surface`, `surface-strong`, `ink`, `ink-muted`, `line`, `accent`, `warn`; font tokens `font-serif`, `font-sans`
  - Layout renders `<IntegrityBanner />` from `@/components/integrity-banner` (created in Task 6). Until Task 6 lands, leave that import and element out; Task 6 adds them.

- [ ] **Step 1: Write the failing test**

`tests/nav.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/courses/econ-101" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { Nav } from "@/components/nav";
import { isActive } from "@/lib/nav";

describe("isActive", () => {
  it("matches the section and its sub-pages only", () => {
    expect(isActive("/courses", "/courses")).toBe(true);
    expect(isActive("/courses/econ-101", "/courses")).toBe(true);
    expect(isActive("/courses-old", "/courses")).toBe(false);
    expect(isActive("/today", "/courses")).toBe(false);
  });
});

describe("Nav", () => {
  it("lists the eight sections in order", () => {
    render(<Nav />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Today",
      "Courses",
      "Deadlines",
      "Prepare Class",
      "Research",
      "Practice",
      "Weekly Review",
      "Settings",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/today",
      "/courses",
      "/deadlines",
      "/prepare",
      "/research",
      "/practice",
      "/review",
      "/settings",
    ]);
  });

  it("marks only the current section", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Today" })).not.toHaveAttribute("aria-current");
  });

  it("is a labelled navigation landmark", () => {
    render(<Nav />);
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/nav.test.tsx`
Expected: FAIL with "Failed to resolve import @/components/nav".

- [ ] **Step 3: Implement nav**

`src/lib/nav.ts`:

```ts
export type NavItem = { href: string; label: string };

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/today", label: "Today" },
  { href: "/courses", label: "Courses" },
  { href: "/deadlines", label: "Deadlines" },
  { href: "/prepare", label: "Prepare Class" },
  { href: "/research", label: "Research" },
  { href: "/practice", label: "Practice" },
  { href: "/review", label: "Weekly Review" },
  { href: "/settings", label: "Settings" },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

`src/components/nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "@/lib/nav";

export function Nav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Main">
      <ul className="-mx-1 flex gap-1 overflow-x-auto pb-1 md:mx-0 md:flex-col md:overflow-visible md:pb-0">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  active
                    ? "bg-surface-strong font-medium text-ink"
                    : "text-ink-muted hover:bg-surface-strong hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/nav.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Replace global styles**

`src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-paper: #f7f5f0;
  --color-surface: #ffffff;
  --color-surface-strong: #ece8df;
  --color-ink: #1f2328;
  --color-ink-muted: #5b616b;
  --color-line: #ddd8cc;
  --color-accent: #2f5d62;
  --color-warn: #9a3b2e;

  --font-serif: ui-serif, "Iowan Old Style", "Palatino Linotype", Georgia, serif;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Segoe UI", sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-paper: #16181b;
    --color-surface: #1e2125;
    --color-surface-strong: #2a2e33;
    --color-ink: #e8e6e1;
    --color-ink-muted: #a3a8b0;
    --color-line: #33373d;
    --color-accent: #8fbcbb;
    --color-warn: #e08a7a;
  }
}

html {
  color-scheme: light dark;
}
```

- [ ] **Step 6: Replace the layout and root page**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "PIEGL Study Agency",
  description: "Private study workspace for ZJU PIEGL.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <div className="mx-auto flex max-w-6xl flex-col md:flex-row md:gap-10 md:px-6">
          <header className="border-b border-line px-4 py-4 md:w-52 md:shrink-0 md:border-b-0 md:px-0 md:py-10">
            <p className="mb-4 font-serif text-lg leading-tight">PIEGL Study Agency</p>
            <Nav />
          </header>
          <main id="main" className="min-w-0 flex-1 px-4 py-8 md:px-0 md:py-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/today");
}
```

- [ ] **Step 7: Run the checks**

Run: `npm run check`
Expected: all PASS. (Visiting a nav link will 404 until Task 5; that is expected.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/nav.ts src/components/nav.tsx src/app/globals.css src/app/layout.tsx src/app/page.tsx tests/nav.test.tsx
git commit -m "Add calm app shell with main navigation and light/dark tokens" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Eight screens with empty states

**Files:**
- Create: `src/components/page-header.tsx`, `src/components/empty-state.tsx`
- Create: `src/app/today/page.tsx`, `src/app/courses/page.tsx`, `src/app/deadlines/page.tsx`, `src/app/prepare/page.tsx`, `src/app/research/page.tsx`, `src/app/practice/page.tsx`, `src/app/review/page.tsx`, `src/app/settings/page.tsx`
- Test: `tests/pages.test.tsx`

**Interfaces:**
- Consumes: `getDataDir`, `DataDirError` from `@/lib/data-dir` (Task 3).
- Produces:
  - `PageHeader({ title, description }: { title: string; description: string })` renders the page `h1`
  - `EmptyState({ title, children }: { title: string; children: React.ReactNode })` renders an `h2` card
  - Practice and Settings pages render `<IntegrityNote />` from `@/components/integrity-note` (Task 6). Until Task 6 lands, leave that import and element out; Task 6 adds them.

- [ ] **Step 1: Write the failing test**

`tests/pages.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CoursesPage from "@/app/courses/page";
import DeadlinesPage from "@/app/deadlines/page";
import PracticePage from "@/app/practice/page";
import PreparePage from "@/app/prepare/page";
import ResearchPage from "@/app/research/page";
import ReviewPage from "@/app/review/page";
import SettingsPage from "@/app/settings/page";
import TodayPage from "@/app/today/page";

const PAGES: [string, ComponentType, string][] = [
  ["today", TodayPage, "Today"],
  ["courses", CoursesPage, "Courses"],
  ["deadlines", DeadlinesPage, "Deadlines"],
  ["prepare", PreparePage, "Prepare Class"],
  ["research", ResearchPage, "Research"],
  ["practice", PracticePage, "Practice"],
  ["review", ReviewPage, "Weekly Review"],
  ["settings", SettingsPage, "Settings"],
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("screens", () => {
  it.each(PAGES)("%s page has its heading", (_name, Page, heading) => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  });

  it("Today answers the four daily questions", () => {
    render(<TodayPage />);
    for (const name of ["Due next", "Prepare next", "Highest-leverage task", "Confusing concepts"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("Settings shows the data folder", () => {
    vi.stubEnv("DATA_DIR", "/tmp/psa-test-data");
    render(<SettingsPage />);
    expect(screen.getByText("/tmp/psa-test-data")).toBeInTheDocument();
  });

  it("Settings explains a bad data folder instead of crashing", () => {
    vi.stubEnv("DATA_DIR", "./data");
    render(<SettingsPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/absolute path/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/pages.test.tsx`
Expected: FAIL with "Failed to resolve import @/app/courses/page".

- [ ] **Step 3: Shared components**

`src/components/page-header.tsx`:

```tsx
type PageHeaderProps = { title: string; description: string };

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
      <p className="mt-2 max-w-prose leading-relaxed text-ink-muted">{description}</p>
    </header>
  );
}
```

`src/components/empty-state.tsx`:

```tsx
type EmptyStateProps = { title: string; children: React.ReactNode };

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-dashed border-line bg-surface p-6">
      <h2 className="font-serif text-lg">{title}</h2>
      <div className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}
```

- [ ] **Step 4: The eight pages**

`src/app/today/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function TodayPage() {
  return (
    <>
      <PageHeader title="Today" description="What is due, what to prepare, and where to put your best hour." />
      <div className="grid gap-4 md:grid-cols-2">
        <EmptyState title="Due next">Nothing due yet. Add a course or a deadline and it will show here.</EmptyState>
        <EmptyState title="Prepare next">Your next class to prepare for will show here.</EmptyState>
        <EmptyState title="Highest-leverage task">
          The one task worth doing first today, with the reason, will show here.
        </EmptyState>
        <EmptyState title="Confusing concepts">Concepts you mark as confusing will collect here.</EmptyState>
      </div>
    </>
  );
}
```

`src/app/courses/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function CoursesPage() {
  return (
    <>
      <PageHeader title="Courses" description="Your courses this semester, with times, instructors, and links." />
      <EmptyState title="No courses yet">Courses you add or sync from ZJU will be listed here.</EmptyState>
    </>
  );
}
```

`src/app/deadlines/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function DeadlinesPage() {
  return (
    <>
      <PageHeader title="Deadlines" description="Upcoming and overdue work, and how heavy each week looks." />
      <EmptyState title="No deadlines yet">
        Assignments, readings, presentations, exams, and personal tasks will be listed here by date.
      </EmptyState>
    </>
  );
}
```

`src/app/prepare/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function PreparePage() {
  return (
    <>
      <PageHeader
        title="Prepare Class"
        description="Turn slides and readings into a Class Ready Brief before each session."
      />
      <EmptyState title="No class materials yet">
        Slides and readings for your next classes will show here, ready to study.
      </EmptyState>
    </>
  );
}
```

`src/app/research/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function ResearchPage() {
  return (
    <>
      <PageHeader
        title="Research"
        description="Break a question into a plan, and keep sources you have checked yourself."
      />
      <EmptyState title="No research questions yet">
        Your research questions and verified sources will be kept here. Sources are only ever added by you.
      </EmptyState>
    </>
  );
}
```

`src/app/practice/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function PracticePage() {
  return (
    <>
      <PageHeader
        title="Practice"
        description="Answer professor-style questions one at a time and get honest feedback."
      />
      <div className="space-y-4">
        <EmptyState title="Nothing to practise yet">
          Questions from your class material will show here once you prepare a class.
        </EmptyState>
      </div>
    </>
  );
}
```

`src/app/review/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function ReviewPage() {
  return (
    <>
      <PageHeader title="Weekly Review" description="Look back at the week and plan a realistic next one." />
      <EmptyState title="No weeks to review yet">
        What you planned, finished, postponed, and found confusing will show here.
      </EmptyState>
    </>
  );
}
```

`src/app/settings/page.tsx`:

```tsx
import { PageHeader } from "@/components/page-header";
import { DataDirError, getDataDir } from "@/lib/data-dir";

export const dynamic = "force-dynamic";

type DataDirStatus = { ok: true; path: string } | { ok: false; message: string };

function readDataDir(): DataDirStatus {
  try {
    return { ok: true, path: getDataDir() };
  } catch (error) {
    if (error instanceof DataDirError) return { ok: false, message: error.message };
    throw error;
  }
}

export default function SettingsPage() {
  const dataDir = readDataDir();

  return (
    <>
      <PageHeader title="Settings" description="Where your data lives, and how the app works." />
      <div className="space-y-4">
        <section className="rounded-lg border border-line bg-surface p-6">
          <h2 className="font-serif text-lg">Data folder</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Your database, course files, and ZJU session are kept here, outside the code repository.
          </p>
          {dataDir.ok ? (
            <p className="mt-3 font-mono text-sm">{dataDir.path}</p>
          ) : (
            <p role="alert" className="mt-3 text-sm text-warn">
              {dataDir.message} Set DATA_DIR in .env.local.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run tests/pages.test.tsx`
Expected: PASS (11 tests).

- [ ] **Step 6: Run all checks**

Run: `npm run check`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/page-header.tsx src/components/empty-state.tsx src/app/*/page.tsx tests/pages.test.tsx
git commit -m "Add eight screens with empty states and data folder status" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Academic-integrity note and first-run banner

**Files:**
- Create: `src/lib/integrity.ts`, `src/components/integrity-note.tsx`, `src/components/integrity-banner.tsx`
- Modify: `src/app/layout.tsx` (add banner), `src/app/practice/page.tsx` and `src/app/settings/page.tsx` (add note)
- Modify: `tests/pages.test.tsx` (add one test)
- Test: `tests/integrity-banner.test.tsx`

**Interfaces:**
- Consumes: layout and pages from Tasks 4 and 5.
- Produces:
  - `INTEGRITY_TEXT: string`, `INTEGRITY_ACK_KEY = "psa.integrityAck.v1"`
  - `<IntegrityNote />` server-safe `aside` labelled "Academic integrity"
  - `<IntegrityBanner />` client component; shows until the user clicks "I understand"; stores `"yes"` under `INTEGRITY_ACK_KEY` in `localStorage` when it can

- [ ] **Step 1: Write the failing tests**

`tests/integrity-banner.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrityBanner } from "@/components/integrity-banner";
import { INTEGRITY_ACK_KEY } from "@/lib/integrity";

const banner = () => screen.queryByRole("region", { name: "Before you start" });

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IntegrityBanner", () => {
  it("shows on first run", () => {
    render(<IntegrityBanner />);
    expect(banner()).toBeInTheDocument();
    expect(banner()).toHaveTextContent(/responsible for your own work/);
  });

  it("hides after 'I understand' and remembers it", async () => {
    const { unmount } = render(<IntegrityBanner />);
    await userEvent.click(screen.getByRole("button", { name: "I understand" }));
    expect(banner()).not.toBeInTheDocument();
    expect(window.localStorage.getItem(INTEGRITY_ACK_KEY)).toBe("yes");

    unmount();
    render(<IntegrityBanner />);
    expect(banner()).not.toBeInTheDocument();
  });

  it("still works when browser storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    render(<IntegrityBanner />);
    expect(banner()).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "I understand" }));
    expect(banner()).not.toBeInTheDocument();
  });
});
```

Append to the `describe("screens", ...)` block in `tests/pages.test.tsx`:

```tsx
  it.each([
    ["practice", PracticePage],
    ["settings", SettingsPage],
  ] as const)("%s shows the integrity note", (_name, Page) => {
    render(<Page />);
    expect(screen.getByRole("complementary", { name: "Academic integrity" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/integrity-banner.test.tsx tests/pages.test.tsx`
Expected: FAIL with "Failed to resolve import @/components/integrity-banner", and the new pages rows fail to find the note.

- [ ] **Step 3: Implement**

`src/lib/integrity.ts`:

```ts
export const INTEGRITY_TEXT =
  "This app is for preparation, learning, and research support. You are responsible for your own work and must follow each course's rules. Do not submit AI-generated work as your own.";

export const INTEGRITY_ACK_KEY = "psa.integrityAck.v1";
```

`src/components/integrity-note.tsx`:

```tsx
import { INTEGRITY_TEXT } from "@/lib/integrity";

export function IntegrityNote() {
  return (
    <aside aria-label="Academic integrity" className="rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed">
      <p className="font-medium">Academic integrity</p>
      <p className="mt-1 max-w-prose text-ink-muted">{INTEGRITY_TEXT}</p>
    </aside>
  );
}
```

`src/components/integrity-banner.tsx`:

```tsx
"use client";

import { useState, useSyncExternalStore } from "react";
import { INTEGRITY_ACK_KEY, INTEGRITY_TEXT } from "@/lib/integrity";

function readAck(): boolean {
  try {
    return window.localStorage.getItem(INTEGRITY_ACK_KEY) === "yes";
  } catch {
    return false;
  }
}

function writeAck(): void {
  try {
    window.localStorage.setItem(INTEGRITY_ACK_KEY, "yes");
  } catch {
    // Storage is blocked; the banner simply returns on the next visit.
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function IntegrityBanner() {
  // Server snapshot is "acknowledged" so the banner never flashes during server render.
  const acknowledged = useSyncExternalStore(subscribe, readAck, () => true);
  const [dismissed, setDismissed] = useState(false);

  if (acknowledged || dismissed) return null;

  return (
    <div role="region" aria-label="Before you start" className="mb-8 rounded-lg border border-accent/40 bg-surface p-4">
      <p className="font-serif text-lg">Before you start</p>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-muted">{INTEGRITY_TEXT}</p>
      <button
        type="button"
        onClick={() => {
          writeAck();
          setDismissed(true);
        }}
        className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        I understand
      </button>
    </div>
  );
}
```

In `src/app/layout.tsx`, add the import below the `Nav` import:

```tsx
import { IntegrityBanner } from "@/components/integrity-banner";
```

and change the `<main>` body to:

```tsx
          <main id="main" className="min-w-0 flex-1 px-4 py-8 md:px-0 md:py-10">
            <IntegrityBanner />
            {children}
          </main>
```

In `src/app/practice/page.tsx`, add `import { IntegrityNote } from "@/components/integrity-note";` and put `<IntegrityNote />` after the `EmptyState` inside the `space-y-4` div.

In `src/app/settings/page.tsx`, add `import { IntegrityNote } from "@/components/integrity-note";` and put `<IntegrityNote />` after the "Data folder" `section` inside the `space-y-4` div.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/integrity-banner.test.tsx tests/pages.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run all checks**

Run: `npm run check`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/integrity.ts src/components/integrity-note.tsx src/components/integrity-banner.tsx src/app/layout.tsx src/app/practice/page.tsx src/app/settings/page.tsx tests/integrity-banner.test.tsx tests/pages.test.tsx
git commit -m "Add academic-integrity note and first-run banner" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: README, privacy, and architecture docs

**Files:**
- Modify: `README.md` (full replace)
- Create: `docs/PRIVACY.md`, `docs/ARCHITECTURE.md`

**Interfaces:**
- Consumes: scripts from Task 1, `DATA_DIR` from Task 3.
- Produces: docs only. `tests/gitignore.test.ts` already asserts `docs/PRIVACY.md` is not ignored.

- [ ] **Step 1: Write `README.md`**

````markdown
# PIEGL Study Agency

A private study workspace for the ZJU PIEGL program. It runs only on your own Mac.

It helps you track course work and deadlines, prepare for each class from slides and readings, practise answering professor questions honestly, keep research notes with clear labels, and plan each week.

## Academic integrity

This app is for preparation, learning, and research support. You are responsible for your own work and must follow each course's rules. It never writes work for you to submit, never invents sources, and never submits anything to ZJU systems.

## Privacy

- The app listens only on `127.0.0.1`. Other devices cannot reach it.
- Your database, course files, extracted text, ZJU login session, and logs live in `DATA_DIR` (default `~/PIEGL-data`), outside this repository. The app refuses a `DATA_DIR` inside the repo.
- `.gitignore` blocks secrets, databases, and course files (`.pdf`, `.ppt(x)`, `.doc(x)`), and a test checks this.
- Your ZJU password is never stored. From milestone M3 you log in yourself in a browser window.
- From milestone M4, text you choose to send goes to the Claude API (Anthropic). Courses can be set to "AI off".

More detail: [docs/PRIVACY.md](docs/PRIVACY.md).

## Setup

Requires Node 24 and npm 11.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3100.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app on 127.0.0.1:3100 |
| `npm run build` | Production build |
| `npm start` | Run the production build on 127.0.0.1:3100 |
| `npm run check` | Lint, typecheck, and tests |

## Supported file types

Planned for milestone M2: PDF and PowerPoint (`.pptx`) with real text. Scanned slides (images only) are not supported yet; OCR is a later phase.

## Limitations

- Mac only, one user, no phone access yet.
- ZJU sync (M3) depends on how ZJU sites work today and may break when they change. Manual entry always works.
- ZJU's terms may not allow automated access. You decide whether to use sync.

## Roadmap

| Milestone | Status |
|---|---|
| M0 Foundation: app shell, privacy guards, docs | Done |
| M1 Courses and Deadlines, demo data | Next |
| M2 Materials: upload, extract, view | Planned |
| M3 ZJU sync: Courses@ZJU and timetable | Planned |
| M4 AI and Class Ready Brief | Planned |
| M5 Professor Mode | Planned |
| M6 Research workspace | Planned |
| M7 Weekly Review and polish | Planned |

Later: PIEGL site sync, DingTalk and email, APA 7 export, spaced repetition, `.ics` feed, OCR, iPhone access.
````

- [ ] **Step 2: Write `docs/PRIVACY.md`**

```markdown
# Privacy and security

## What stays on your Mac

Everything private lives in `DATA_DIR` (default `~/PIEGL-data`):

- the SQLite database
- original course files (slides, readings)
- extracted text
- the ZJU login session (from M3)
- logs

`src/lib/data-dir.ts` refuses any `DATA_DIR` inside the repository, including case variants on macOS. The folder is created with owner-only permissions (`0700`).

## What never goes in git

`.gitignore` blocks `.env*` (except `.env.example`), keys, databases, data folders, course files, and logs. `tests/gitignore.test.ts` fails if any of these patterns stop being ignored or if an ignored file is already tracked.

## Network

- The server binds to `127.0.0.1:3100` only (`tests/server-binding.test.ts`).
- ZJU sync (M3) is read-only, manual ("Sync now"), and slow. You log in yourself in a visible browser window. Passwords are never stored. "Forget ZJU session" deletes the saved session.
- AI (M4) sends only the text you choose to the Claude API. You see what will be sent first. Courses set to "AI off" are never sent.

## Academic integrity

- No feature writes assignments or answers for submission.
- Professor Mode gives answer outlines, not scripts.
- AI can suggest search terms but cannot create sources. Only you add and verify sources.
- Every AI output is labelled and points to the pages it came from.
```

- [ ] **Step 3: Write `docs/ARCHITECTURE.md`**

````markdown
# Architecture

One Next.js (App Router) project. Server code handles anything private: files, the database, ZJU sync, and the API key. The browser never sees secrets.

```
src/app/          one route per screen (Today, Courses, Deadlines, Prepare, Research, Practice, Review, Settings)
src/components/   shared UI (nav, page header, empty state, integrity note and banner)
src/lib/          plain logic (nav, data-dir, integrity text)
tests/            Vitest tests
docs/             privacy, architecture, specs and plans
```

Planned additions: `src/db/` (Drizzle + SQLite, M1), `src/extract/` (PDF and PPTX, M2), `src/sync/` (Playwright, M3), `src/ai/` (provider interface and Claude adapter, M4).

Do not name source folders `data`, `uploads`, `extracted`, `sessions`, or `logs`: `.gitignore` blocks those names anywhere in the tree, on purpose.

## Design tokens

Colors and fonts are defined once in `src/app/globals.css` (`@theme`) with a dark-mode override. Use the token classes (`bg-paper`, `text-ink`, `text-ink-muted`, `border-line`, `bg-accent`, `text-warn`) instead of raw colors.

## Decisions

The approved design is in `docs/superpowers/specs/2026-10-12-piegl-study-agency-design.md`.
````

- [ ] **Step 4: Run all checks**

Run: `npm run check`
Expected: all PASS (the `docs/PRIVACY.md` keep-row now refers to a real file).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/PRIVACY.md docs/ARCHITECTURE.md
git commit -m "Add README, privacy and architecture docs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verify in the browser and push to a private GitHub repo

**Files:**
- Create (not committed, ignored by `.claude/`): `.claude/launch.json`
- Modify (outside repo): `~/.ssh/config` (append one host block); create `~/.ssh/id_ed25519_piegl` and `.pub`

**Interfaces:**
- Consumes: everything above.
- Produces: `origin` remote `git@github.com-piegl:cpamukcu/piegl-study-agency.git`, `main` pushed.

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds; routes `/today`, `/courses`, `/deadlines`, `/prepare`, `/research`, `/practice`, `/review`, `/settings` listed.

- [ ] **Step 2: Preview config**

`.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "study-agency", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 3100 }
  ]
}
```

- [ ] **Step 3: Check it in the browser**

Start the preview `study-agency`. Then:
- `/` redirects to `/today`; Today shows the four cards.
- Each of the 8 nav links loads and gets `aria-current="page"`.
- Integrity banner shows; "I understand" hides it; reload keeps it hidden.
- Settings shows `~/PIEGL-data`.
- Tab from page load: "Skip to content" appears first; focus rings are visible.
- Mobile width (375px): nav scrolls sideways, no page-wide horizontal scroll.
- Dark mode: text readable.
- Console has no errors.

Run: `lsof -nP -iTCP:3100 -sTCP:LISTEN`
Expected: listening address is `127.0.0.1:3100`, not `*:3100`.

Take a screenshot of Today for the milestone report.

- [ ] **Step 4: Final repo check**

Run: `git status --short && git ls-files`
Expected: clean tree; tracked files are only source, config, tests, docs, `.env.example`, `public/` leftovers if any, `src/app/favicon.ico`.

- [ ] **Step 5: Owner creates the private repo**

Ask the owner to create an empty **private** repo `cpamukcu/piegl-study-agency` on github.com (no README, no .gitignore, no license). Wait for confirmation.

- [ ] **Step 6: Deploy key**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_piegl -N "" -C "piegl-study-agency deploy key"
printf '\nHost github.com-piegl\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/id_ed25519_piegl\n  IdentitiesOnly yes\n' >> ~/.ssh/config
cat ~/.ssh/id_ed25519_piegl.pub
```

Ask the owner to add the printed public key under the repo's Settings → Deploy keys, with **Allow write access** ticked. Wait for confirmation.

- [ ] **Step 7: Push**

```bash
git remote add origin git@github.com-piegl:cpamukcu/piegl-study-agency.git
git push -u origin main
```

Expected: push succeeds.

- [ ] **Step 8: Confirm it is private**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://github.com/cpamukcu/piegl-study-agency`
Expected: `404` (not visible publicly). If it prints `200`, stop and ask the owner to switch the repo to private.

- [ ] **Step 9: Milestone report**

Report to the owner: checks run and results, screenshot, what changed, files changed, and ask before starting M1.

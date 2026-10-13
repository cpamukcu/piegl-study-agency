# Architecture

One Next.js (App Router) project. Server code handles anything private: files, the database, ZJU sync, and the API key. The browser never sees secrets.

```
src/app/            routes; one per screen, plus /courses/[id]
src/app/actions.ts  server actions (validate with src/lib/forms.ts, write, refresh)
src/components/     UI; *-data.tsx are async server components that read the database
src/db/             SQLite (node:sqlite): connection + migrations, one module per table group
src/import/         snapshot schemas (Zod), mapping, and the import runner
src/lib/            pure logic: time (Shanghai), sessions, recurrence, priority, workload, forms
src/proxy.ts        refuses non-local Host headers (DNS rebinding guard)
tests/              Vitest tests; tests/helpers has an in-memory database and a task factory
sample-data/        fake snapshots used by tests
```

Rules:
- Every database read in a page happens inside `<Suspense>` after `await connection()`, because Cache Components is on and would otherwise run the read at build time. Request time comes from `requestTime()` in `src/lib/clock.ts`.
- Client components never import `src/db/*` or `src/import/*` values (they pull in `node:sqlite`); type-only imports are fine.
- Times are UTC milliseconds in storage and Shanghai time on screen (`src/lib/time.ts`).

Planned additions: `src/extract/` (PDF and PPTX, M2), `src/sync/` (Playwright), `src/ai/` (provider interface and Claude adapter, M4).

Do not name source folders `data`, `uploads`, `extracted`, `sessions`, or `logs`: `.gitignore` blocks those names anywhere in the tree, on purpose.

## Design tokens

Colors and fonts are defined once in `src/app/globals.css` (`@theme`) with a dark-mode override. Use the token classes (`bg-paper`, `text-ink`, `text-ink-muted`, `border-line`, `bg-accent`, `text-warn`) instead of raw colors.

## Decisions

The approved design is in `docs/superpowers/specs/2026-10-12-piegl-study-agency-design.md`.

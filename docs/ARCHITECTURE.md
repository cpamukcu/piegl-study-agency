# Architecture

One Next.js (App Router) project. Server code handles anything private: files, the database, ZJU sync, and the API key. The browser never sees secrets.

```
src/app/            routes; one per screen, plus /courses/[id]
src/app/actions.ts  server actions (validate with src/lib/forms.ts, write, refresh)
src/components/     UI; *-data.tsx are async server components that read the database
src/db/             SQLite (node:sqlite): connection + migrations, one module per table group
                    (courses, tasks, materials, study = briefs/concepts/cards/questions, research, reviews)
src/extract/        per-page text from PDF (unpdf) and PPTX (slide XML via fflate); no OCR
src/ai/             AIProvider interface, Claude adapter, and the brief / assess / research-plan prompts and schemas
src/sync/           Playwright sync: Courses@ZJU, graduate timetable, course-file downloads, launchd schedule
src/import/         snapshot schemas (Zod), mapping, and the import runner
src/lib/            pure logic: time (Shanghai), sessions, recurrence, priority, workload, forms
src/proxy.ts        refuses non-local Host headers (DNS rebinding guard)
tests/              Vitest tests; tests/helpers has an in-memory database, a task factory, a fake AI provider,
                    and builders for small real PDF and PPTX files (the repo never holds course files)
sample-data/        fake snapshots used by tests
```

Rules:
- Every database read in a page happens inside `<Suspense>` after `await connection()`, because Cache Components is on and would otherwise run the read at build time. Request time comes from `requestTime()` in `src/lib/clock.ts`.
- Client components never import `src/db/*` or `src/import/*` values (they pull in `node:sqlite`); type-only imports are fine.
- Times are UTC milliseconds in storage and Shanghai time on screen (`src/lib/time.ts`).

## AI rules in code

- Every AI call goes through `AIProvider.generate` with a Zod schema; the result is validated before it is stored, together with the model name.
- `getProvider()` returns `null` when `ANTHROPIC_API_KEY` is unset; every AI feature checks that and the course's `aiAllowed` flag before building a request.
- The Claude adapter uses structured outputs (`output_config.format`) and server-side refusal fallback, and turns API errors into `AiError` messages the owner can act on.
- Page references come back as `"<file>:<page>"` refs that are mapped to real pages; anything that does not match a page that was sent is dropped.
- Tests use `tests/helpers/fake-ai.ts`; no test calls the real API.

Do not name source folders `data`, `uploads`, `extracted`, `sessions`, or `logs`: `.gitignore` blocks those names anywhere in the tree, on purpose.

## Design tokens

Colors and fonts are defined once in `src/app/globals.css` (`@theme`) with a dark-mode override. Use the token classes (`bg-paper`, `text-ink`, `text-ink-muted`, `border-line`, `bg-accent`, `text-warn`) instead of raw colors.

## Decisions

The approved design is in `docs/superpowers/specs/2026-10-12-piegl-study-agency-design.md`.

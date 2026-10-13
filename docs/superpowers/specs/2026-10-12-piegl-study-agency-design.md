# PIEGL Study Agency — Design Spec

Status: approved in chat on 2026-10-12. This file records that plan.

## 1. Product brief

PIEGL Study Agency is a private study app that runs only on the owner's Mac. It brings ZJU deadlines and course files into one calm place, prepares the owner for each class, lets them practise answering professor questions honestly, keeps labelled research notes, and helps plan each week. It supports learning. It does not produce work to submit.

## 2. Decisions

| Topic | Decision |
|---|---|
| Relation to ATLAS | Separate app, own private repo. ATLAS may later read an `.ics` deadline feed. |
| Where it runs | Mac only, server bound to `127.0.0.1`. iPhone access is a later phase. |
| Code location | `~/PIEGL/study-agency` |
| Private data location | `~/PIEGL-data` (set by `DATA_DIR`), outside the repo |
| GitHub | Public repo under the `cpamukcu` account (owner chose public on 2026-10-13 to share with a teacher). Private data never enters the repo. Pushed with a repo deploy key |
| ZJU data | Read-only sync from Courses@ZJU (学在浙大), the timetable / 教务系统, the PIEGL program site, and DingTalk / email. MVP covers Courses@ZJU and the timetable. |
| AI provider | Claude API first, behind a provider interface. App works with AI turned off. |

### Sync rules

- The owner logs in personally in a visible Playwright browser window. The app never sees, types, or stores ZJU passwords.
- The login session is stored only under `DATA_DIR`. A "Forget ZJU session" button deletes it.
- Read-only: the app never submits, posts, or changes anything on ZJU systems.
- Manual "Sync now" only, slow request rate, JSON endpoints preferred over page parsing.
- Every sync shows a review of changes before import.
- Manual entry always remains as a fallback.
- Accepted risks: ZJU terms may not allow automated access, accounts could be flagged, and site changes can break sync.

## 3. Assumptions and open questions

Assumptions: one user with no app login; English UI; Asia/Shanghai time zone; semester teaching weeks; slides are mostly text-based PDF or PPTX (no OCR in MVP); Claude model set in `.env`.

Open (not blocking M0): number of courses; material language (English, Chinese, or both); PIEGL program site URL; semester start date; course-specific AI rules.

## 4. Scope

| MVP | Later |
|---|---|
| Courses, all task types, recurring weekly prep tasks | PIEGL site sync |
| Today, Deadlines, weekly workload, priority with a "why" | DingTalk and email |
| Upload PDF/PPTX, extract text, view the original | APA 7 export |
| Courses@ZJU and timetable sync (read-only) | Spaced-repetition schedule |
| Class Ready Brief, concept marks, flashcards, practice questions | `.ics` feed for ATLAS and iPhone |
| Professor Mode | OCR for scanned slides |
| Research briefs and source library | Full-text search across material |
| Weekly review, integrity note, backup | iPhone access |

## 5. Data model (SQLite)

- **Course**: title, code, instructor, semester, color, meeting times (day, time, room, weeks), links, `aiAllowed`, source (`manual` or `zju`), externalId
- **ClassSession**: course, start time, teaching week, topic. Generated from meeting times; briefs and materials attach here.
- **Task**: course (optional), type (`assignment`, `reading`, `presentation`, `exam`, `personal`, `prep`), due date, estimated minutes, importance (1–3), status (`todo`, `doing`, `done`, `postponed`), notes, recurrence, source, externalId
- **RecurrenceRule**: e.g. "Prep for course X, 1 day before each class, 45 min"
- **Material**: course or session, filename, kind, path under `DATA_DIR`, sha256, page count, extraction status
- **MaterialPage**: material, page or slide number, text
- **Brief**: session, materials used, sections (JSON with page references), model, created date
- **Concept**: term, definition, status (`understand`, `review`, `confusing`), page reference
- **Flashcard**, **PracticeQuestion**: each with a page reference
- **PracticeAttempt**: answer plus assessment (accuracy, clarity, evidence, missing points, outline, facts vs interpretation)
- **ResearchProject**: question, subquestions, search terms, perspectives, plan
- **Source**: title, authors, date, URL or DOI, notes, relevance, `verified` (only the owner can set it)
- **Note**: body plus label (`mine`, `ai-interpretation`, `from-source` with source id)
- **WeeklyReview**: week, plan snapshot, reflection, next-week plan
- **SyncRun**: site, time, counts, errors

## 6. Screens and flows

Navigation: Today, Courses, Deadlines, Prepare Class, Research, Practice, Weekly Review, Settings.

- **Today** answers: what is due next, what to prepare next, the highest-leverage task (with its reason), and what is marked confusing.
- **Before class**: Prepare Class → session → materials → brief → mark concepts → flashcards → Professor Mode.
- **Sync**: Settings → Sync now → login window → review changes → import.
- **Research**: question → research brief → owner adds and verifies sources → labelled notes.
- **Weekly**: Weekly Review → reflection → accept or edit the suggested next-week plan.

UX: calm and academic, readable type, clear dates, keyboard-friendly, empty states, mobile-responsive, no gamification.

## 7. Privacy, security, and integrity

Privacy and security:
- Server listens only on `127.0.0.1`.
- Database, files, extracted text, sessions, and logs live under `DATA_DIR`, never in the repo.
- `.env` holds only the Claude API key and is gitignored; `.env.example` has blank values.
- No ZJU passwords are stored anywhere.
- Per-course AI switch; material from "AI off" courses is never sent anywhere.
- The owner sees what will be sent before a request goes to Claude. README states that this data goes to Anthropic's API.
- A test fails if data file patterns are not gitignored.

Academic integrity:
- Integrity note on first run, in Settings, and in Practice.
- No feature writes assignments.
- Professor Mode gives answer outlines, not scripts.
- AI may suggest search terms but can never create a Source.
- Every AI output is labelled and points to the pages it came from.
- The app never submits anything to any ZJU system.

## 8. Repository

```
study-agency/
  src/app/        one route per screen
  src/components/
  src/db/         schema, migrations, demo seed
  src/lib/        priority, dates, recurrence
  src/ai/         provider interface, Claude adapter, prompts
  src/extract/    pdf, pptx
  src/sync/       Courses@ZJU, timetable, session
  tests/
  docs/           ARCHITECTURE, PRIVACY, data-sources, specs
  sample-data/    fake demo data only
  .env.example  README.md
```

`.gitignore` covers: `node_modules`, `.next`, `.env*` (except `.env.example`), `*.db`, `*.sqlite*`, `data/`, `uploads/`, `extracted/`, `sessions/`, `playwright/.auth`, `*.log`, `*.pdf`, `*.ppt*`, `*.doc*`, `*.key`, `.DS_Store`, `coverage`.

## 9. Milestones

| # | Milestone | Acceptance criteria |
|---|---|---|
| M0 | Foundation: private repo, scaffold, `.gitignore`, README, app shell with 8 empty screens, integrity note, demo data | Runs on 127.0.0.1; `git status` shows no data files; ignore test passes |
| M1 | Courses and Deadlines: CRUD, recurring prep, Today, Deadlines, workload, explained priority, keyboard shortcuts | Tests for priority, recurrence, and time zone pass; demo data shows correct overdue and upcoming items |
| M2 | Materials: upload, store, per-page extraction, viewer | Sample PDF and PPTX extract with page numbers; files land only under `DATA_DIR` |
| M3 | ZJU sync (Courses@ZJU and timetable) | With the owner logged in, real items import after review; a second sync creates no duplicates; endpoints documented in `docs/data-sources.md` |
| M4 | AI layer and Class Ready Brief, concepts, flashcards, practice questions | Briefs cite slide numbers; "AI off" courses blocked; tests pass with a fake provider |
| M5 | Professor Mode | One question at a time; rubric assessment; outline not script; facts vs interpretation labelled |
| M6 | Research workspace | AI cannot create sources; labels visible; only the owner sets `verified` |
| M7 | Weekly Review and polish (mobile, accessibility) | Reflection saves; next-week plan respects deadlines |

Each milestone ends with checks, a summary of changes and files, and a stop for approval.

## 10. Stack

- Next.js (App Router) + TypeScript: one project for UI and server work (files, SQLite, Playwright, API key kept off the browser). Tradeoff: heavier than Vite.
- Tailwind CSS + shadcn/ui (Radix) for accessible components.
- SQLite via better-sqlite3 + Drizzle ORM: no separate engine, plain migrations, typed.
- pdfjs-dist for PDF text and viewing. PPTX text read from slide XML; LibreOffice converts PPTX to PDF for viewing.
- Playwright for sync, using a visible window.
- `@anthropic-ai/sdk` behind an `AIProvider` interface; default model Claude Sonnet 5.5, Opus 5.5 optional for Professor Mode; Zod validates AI output.
- Vitest for logic, Playwright for UI tests.

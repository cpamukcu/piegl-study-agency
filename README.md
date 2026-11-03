# PIEGL Study Agency

A private study workspace for ZJU's PIEGL programme (Program in Innovation, Entrepreneurship and Global Leadership). It runs only on your own Mac.

It helps you track course work and deadlines, prepare for each class from slides and readings, practise answering professor questions honestly, keep research notes with clear labels, and plan each week.

## Academic integrity

This app is for preparation, learning, and research support. You are responsible for your own work and must follow each course's rules. It never writes work for you to submit, never invents sources, and never submits anything to ZJU systems.

## Privacy

- The app listens only on `127.0.0.1`, and refuses requests that name any other host. Other devices and other websites cannot read it.
- Your database, course files, extracted text, ZJU login session, and logs live in `DATA_DIR` (default `~/PIEGL-data`), outside this repository. The app refuses a `DATA_DIR` inside the repo.
- The database is one SQLite file, `DATA_DIR/study.db`, readable only by you.
- `.gitignore` blocks secrets, databases, and course files (`.pdf`, `.ppt(x)`, `.doc(x)`), and a test checks this.
- Your ZJU password is never stored. You log in yourself in a browser window.
- With an API key set, text you choose to send goes to the Claude API (Anthropic), after you see it. Courses can be set to "AI off".

More detail: [docs/PRIVACY.md](docs/PRIVACY.md).

## Setup

Requires Node 24 and npm 11.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3100.

To be greeted by name on Today, set `STUDENT_NAME` in `.env.local` (optional).

### Try it with sample data

The repo holds no real student data. To see the app filled in, copy the fake snapshots into your data folder and import them:

```bash
mkdir -p ~/PIEGL-data/snapshots
cp sample-data/courses-zju-sample.json ~/PIEGL-data/snapshots/courses-zju-2026-10-12.json
cp sample-data/timetable-yjsy-sample.json ~/PIEGL-data/snapshots/timetable-yjsy-2026-10-12.json
```

Then open **Settings → ZJU snapshots → Import ZJU snapshots**.

## Your ZJU data

The app reads saved snapshots of your Courses@ZJU data and graduate-system timetable from `DATA_DIR/snapshots/` (`courses-zju-YYYY-MM-DD.json`, `timetable-yjsy-YYYY-MM-DD.json`). Open **Settings → ZJU snapshots → Import**. Importing again later adds new items and picks up ZJU's changes (such as a moved due date), but never undoes your own edits: anything you renamed, re-dated, postponed, estimated, marked done or deleted stays as you left it.

Fake examples of both files are in `sample-data/`. Automatic sync is described below.

To show course names in English, put `course-names.json` in the same folder: a map from each ZJU course title to its English title, for example `{ "示例课程": "Example Course" }`. Rooms, semesters and room notes are translated automatically. You can also rename any course or task in the app; importing again never undoes that.

## Automatic sync (every few days)

Runs on your Mac. A dedicated Chrome profile (`DATA_DIR/browser-profile`, not your everyday Chrome) reads your Courses@ZJU courses, deadlines and exams plus your graduate-system timetable with read-only requests, saves dated snapshots, and imports them. It then downloads the PDF and PPTX files your teachers posted (up to 40 per run) into `DATA_DIR/materials` and reads their text. Your own edits are never overwritten, and a file you delete is not downloaded again.

```bash
npx playwright install chromium   # only if you do not use Google Chrome (then set SYNC_BROWSER=chromium)
npm run sync:login      # once: a window opens, you log in to ZJU yourself, it closes by itself
npm run sync -- --force # try it now
npm run sync:schedule   # every morning at 08:30 it syncs if the last good sync is 3+ days old
npm run sync:unschedule # turn it off
```

- `SYNC_EVERY_DAYS` in `.env.local` changes the interval (default 3). `SYNC_MATERIALS=0` skips course-file downloads. A Mac that was asleep makes up the missed run when it wakes.
- When ZJU logs you out, the sync stops, shows a macOS notification and Settings says so. Run `npm run sync:login` again. Failed runs retry the next morning.
- The login is kept in `DATA_DIR/zju-session.json` (readable only by you). Your password is never seen or stored. Delete that file and `DATA_DIR/browser-profile` to forget the session.
- Logs: `DATA_DIR/logs/sync.log`. Status: Settings → Automatic ZJU sync.
- Spring–summer term: set `ZJU_YJSY_XQ` (see `.env.example`).
- The network notes in `docs/data-sources.md` (Mullvad split tunnel, DNS) apply to this Chrome too.
- If ZJU changes a page or API, the sync fails with a message instead of importing partial data.

## Studying with the app

| Screen | What it does |
|---|---|
| Courses → a course → Materials | Upload slides and readings (PDF, PPTX, text), or let sync bring them from Courses@ZJU. Each file opens as page-by-page text with a link to the original page. |
| Prepare Class | Pick the next class (from your timetable) or a course, tick the files, and see exactly what would be sent. Then make a **Class Ready Brief**: overview, key points, concepts, questions to raise in class, flashcards and practice questions, every item linked to its page. Mark each concept *I understand*, *Review* or *Confusing*; confusing ones show on Today. |
| Practice | **Professor Mode**: one question at a time. Answer in your own words; get scores for accuracy, clarity and evidence, what was missing, a short outline (notes, not a script) with each point labelled *fact* (with its page) or *interpretation*, and the follow-up a professor might ask. You can add your own questions. |
| Research | Write a research question, optionally ask for a plan (smaller questions, search terms in English and Chinese, perspectives, where to look). The AI never names sources: you add them, and only you can mark one *verified*. Notes are labelled *mine*, *from a source* or *AI interpretation*. |
| Weekly Review | The week in numbers (finished, postponed, overdue, practice), a short reflection, and a suggested plan for next week: earliest deadline first, about 3 hours a day, never after a task's deadline. Edit and save; each day's items show on Today. |

### Turning AI on

Put your Anthropic API key in `.env.local` as `ANTHROPIC_API_KEY=…` and restart the app. Briefs and research plans use `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`); set `ANTHROPIC_PROFESSOR_MODEL=claude-opus-5-5` to grade Professor Mode answers with a stronger model. Without a key everything else works and nothing is sent. To keep one course away from AI entirely, open it and press **Turn AI off for this course**. What is sent, exactly, is in [docs/PRIVACY.md](docs/PRIVACY.md#what-goes-to-anthropic-only-when-ai-is-on).

## Public demo

A read-only copy with fake data lives at https://cpamukcu.github.io/piegl-study-agency/today/. It is rebuilt from this code by `npm run demo -- <folder>`: the script seeds invented courses, files and AI results (`scripts/demo/seed.ts`) in a temporary folder, makes a production build under `/piegl-study-agency`, saves every page reachable from Today as static HTML, and adds a small script so links work and forms show a "nothing is saved" note instead of submitting. Publish the folder as the whole content of the `gh-pages` branch. No real data is ever involved, and no AI request is made.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app on 127.0.0.1:3100 |
| `npm run build` | Production build |
| `npm start` | Run the production build on 127.0.0.1:3100 |
| `npm run check` | Lint, typecheck, and tests |
| `npm run demo -- <folder>` | Build the static public demo with fake data (see above) |

## Supported file types

PDF and PowerPoint (`.pptx`, including speaker notes) with real text, plus `.txt` and `.md`. Other files (`.ppt`, `.docx`, …) are kept and can be downloaded but not read. Scanned slides (images only) show as "no text layer"; OCR is a later phase. Files over 50 MB are refused.

## Limitations

- Mac only, one user, no phone access yet.
- ZJU sync depends on how ZJU sites work today and may break when they change. Manual entry and upload always work.
- The course-file download endpoint comes from an open-source TronClass client and has not yet been confirmed from a live ZJU session (see `docs/data-sources.md`).
- ZJU's terms may not allow automated access. You decide whether to use sync.

## Roadmap

| Milestone | Status |
|---|---|
| M0 Foundation: app shell, privacy guards, docs | Done |
| M1 Courses and Deadlines, snapshot import | Done |
| Sync: Courses@ZJU and timetable, read-only | Built, needs a first real run on your Mac |
| M2 Materials: upload, extract, view, download from Courses@ZJU | Done (download needs a first real run) |
| M4 AI and Class Ready Brief | Done |
| M5 Professor Mode | Done |
| M6 Research workspace | Done |
| M7 Weekly Review and polish | Done |

Later: PIEGL site sync, DingTalk and email, APA 7 export, spaced repetition, `.ics` feed, OCR, iPhone access.

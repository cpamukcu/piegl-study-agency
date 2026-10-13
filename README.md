# PIEGL Study Agency

A private study workspace for the ZJU PIEGL program. It runs only on your own Mac.

It helps you track course work and deadlines, prepare for each class from slides and readings, practise answering professor questions honestly, keep research notes with clear labels, and plan each week.

## Academic integrity

This app is for preparation, learning, and research support. You are responsible for your own work and must follow each course's rules. It never writes work for you to submit, never invents sources, and never submits anything to ZJU systems.

## Privacy

- The app listens only on `127.0.0.1`, and refuses requests that name any other host. Other devices and other websites cannot read it.
- Your database, course files, extracted text, ZJU login session, and logs live in `DATA_DIR` (default `~/PIEGL-data`), outside this repository. The app refuses a `DATA_DIR` inside the repo.
- The database is one SQLite file, `DATA_DIR/study.db`, readable only by you.
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

Fake examples of both files are in `sample-data/`. Automatic sync from ZJU arrives in the sync milestone.

To show course names in English, put `course-names.json` in the same folder: a map from each ZJU course title to its English title, for example `{ "示例课程": "Example Course" }`. Rooms, semesters and room notes are translated automatically. You can also rename any course or task in the app; importing again never undoes that.

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
| M1 Courses and Deadlines, snapshot import | Done |
| Sync: Courses@ZJU and timetable, read-only | Next |
| M2 Materials: upload, extract, view, download from Courses@ZJU | Planned |
| M4 AI and Class Ready Brief | Planned |
| M5 Professor Mode | Planned |
| M6 Research workspace | Planned |
| M7 Weekly Review and polish | Planned |

Later: PIEGL site sync, DingTalk and email, APA 7 export, spaced repetition, `.ics` feed, OCR, iPhone access.

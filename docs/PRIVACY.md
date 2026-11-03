# Privacy and security

## What stays on your Mac

Everything private lives in `DATA_DIR` (default `~/PIEGL-data`):

- the SQLite database (`study.db`, mode `0600`)
- saved ZJU snapshots (`snapshots/`)
- original course files (`materials/<course id>/`, mode `0600`), whether you uploaded them or sync downloaded them from Courses@ZJU
- extracted page text (in the database)
- the ZJU login session (`zju-session.json`) and the sync browser profile
- logs

`src/lib/data-dir.ts` refuses any `DATA_DIR` inside the repository, including case variants on macOS. The folder is created with owner-only permissions (`0700`).

## What never goes in git

`.gitignore` blocks `.env*` (except `.env.example`), keys, databases, data folders, course files, and logs. `tests/gitignore.test.ts` fails if any of these patterns stop being ignored or if an ignored file is already tracked.

## Network

- The server binds to `127.0.0.1:3100` only (`tests/server-binding.test.ts`).
- `src/proxy.ts` refuses any request whose `Host` is not `127.0.0.1`, `localhost`, or `[::1]` (403). This stops a web page from pointing its own domain at your Mac (DNS rebinding) and reading the app (`tests/proxy.test.ts`).
- Next.js telemetry (anonymous usage stats sent to Vercel) is turned off in every `dev`, `build`, and `start` script with `NEXT_TELEMETRY_DISABLED=1`. If you run `next` directly, run `npx next telemetry disable` once.
- ZJU sync is read-only (GET requests only) and slow (a pause between requests). You log in yourself in a visible browser window. Passwords are never stored. Course files are downloaded the same way; set `SYNC_MATERIALS=0` to skip them. A file you delete is remembered and not downloaded again.
- Course files are served back to you only by this app on `127.0.0.1` (`/materials/<id>/file`).

## What goes to Anthropic (only when AI is on)

AI is off until you put `ANTHROPIC_API_KEY` in `.env.local`. With it on, three things send text to the Claude API, and only when you press the button:

| Feature | What is sent |
|---|---|
| Class Ready Brief | The page text of the files you tick, the course title, code and teacher, and the class date. Prepare Class shows the full text and instructions before you send. |
| Professor Mode | The question, its cited pages plus the pages next to them, and your answer. |
| Research plan | Your research question and the course title. |

Never sent: your tasks, deadlines, notes, sources, other courses, file paths, your name, or your ZJU account. A course set to "AI off" (on its course page) is never sent, and the app refuses before any request is made (`tests/ai/*.test.ts`). Anthropic's API terms apply to what is sent.

## Academic integrity

- No feature writes assignments or answers for submission.
- Professor Mode gives answer outlines, not scripts.
- AI can suggest search terms but cannot create sources. Only you add and verify sources.
- Every AI output is labelled with the model that made it and points to the pages it came from. Brief items whose page references do not match a page that was actually sent are dropped, and the brief says how many.
- In Professor Mode, an outline point labelled "fact" must cite a real page; otherwise it is shown as interpretation.
- The research plan's schema has no field for papers, authors or links, and no AI code path writes to the sources table.

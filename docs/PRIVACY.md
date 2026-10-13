# Privacy and security

## What stays on your Mac

Everything private lives in `DATA_DIR` (default `~/PIEGL-data`):

- the SQLite database (`study.db`, mode `0600`)
- saved ZJU snapshots (`snapshots/`)
- original course files (slides, readings)
- extracted text
- the ZJU login session (from M3)
- logs

`src/lib/data-dir.ts` refuses any `DATA_DIR` inside the repository, including case variants on macOS. The folder is created with owner-only permissions (`0700`).

## What never goes in git

`.gitignore` blocks `.env*` (except `.env.example`), keys, databases, data folders, course files, and logs. `tests/gitignore.test.ts` fails if any of these patterns stop being ignored or if an ignored file is already tracked.

## Network

- The server binds to `127.0.0.1:3100` only (`tests/server-binding.test.ts`).
- `src/proxy.ts` refuses any request whose `Host` is not `127.0.0.1`, `localhost`, or `[::1]` (403). This stops a web page from pointing its own domain at your Mac (DNS rebinding) and reading the app (`tests/proxy.test.ts`).
- Next.js telemetry (anonymous usage stats sent to Vercel) is turned off in every `dev`, `build`, and `start` script with `NEXT_TELEMETRY_DISABLED=1`. If you run `next` directly, run `npx next telemetry disable` once.
- ZJU sync (M3) is read-only, manual ("Sync now"), and slow. You log in yourself in a visible browser window. Passwords are never stored. "Forget ZJU session" deletes the saved session.
- AI (M4) sends only the text you choose to the Claude API. You see what will be sent first. Courses set to "AI off" are never sent.

## Academic integrity

- No feature writes assignments or answers for submission.
- Professor Mode gives answer outlines, not scripts.
- AI can suggest search terms but cannot create sources. Only you add and verify sources.
- Every AI output is labelled and points to the pages it came from.

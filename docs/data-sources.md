# ZJU data sources

Findings from a read-only spike on 2026-10-12. Field names and endpoints only; no personal data belongs in this file.

All access is read-only, as the owner, through the owner's own logged-in browser session. The app never stores the ZJU password. Snapshots live in `DATA_DIR/snapshots/`, never in the repo.

## Network notes (owner's Mac)

- On campus Wi-Fi (ZJUWLAN), ZJU sites resolve only when DNS is not owned by Mullvad or by the Sangfor aTrust client.
- Working setup: Mullvad split tunneling excludes Google Chrome, and Chrome uses secure DNS `https://dns.alidns.com/dns-query`.
- The sync browser (Playwright, M3) will need the same treatment: exclude its Chromium from Mullvad, or give it a DNS-over-HTTPS resolver.

## Login

- ZJU single sign-on (CAS): `https://zjuam.zju.edu.cn/cas/login?service=<return URL>`.
- One SSO login covers Courses@ZJU, the undergraduate 教务 system and the graduate system.

## Courses@ZJU (学在浙大), `https://courses.zju.edu.cn`

Platform: TronClass (WisdomGarden). Auth: session cookie. Same-origin `GET` returning JSON.

| Endpoint | Gives | Useful fields |
|---|---|---|
| `GET /api/my-courses?page=1&page_size=100` | Enrolled courses | `id`, `name`, `course_code`, `instructors[].name`, `semester.name`, `academic_year.name`, `department.name`, `start_date`, `end_date`, `credit` |
| `GET /api/todos?no-intercept=true` | Open to-dos across courses | `todo_list[]`: `id`, `type` (`homework`, `exam`), `title`, `course_id`, `course_name`, `end_time` (UTC) |
| `GET /api/courses/{id}/activities` | Materials, homework, forums, pages, links | `activities[]`: `id`, `type` (`material`, `homework`, `forum`, `page`, `web_link`), `title`, `start_time`, `end_time`, `is_closed`, `published`, `module_id`, `uploads[]` (`id`, `reference_id`, `name`, `size`, `type`) |
| `GET /api/uploads/reference/document/{reference_id}/url?preview=false` | A short-lived download link for one file | `url` |
| `GET /api/courses/{id}/exams` | Quizzes and exams | `exams[]`: `id`, `title`, `type`, `start_time`, `end_time`, `is_closed` |
| `GET /api/courses/{id}` | Course detail | `classroom_schedule` exists but was `null` for every course; timetable must come from the graduate system |

File downloads (checked 2026-11-03 against the open-source TronClass client `GGQQmax/tronclass-cli`, which targets `courses.zju.edu.cn`): the download is keyed by the upload's `reference_id`, not its `id`. `GET /api/uploads/reference/document/{reference_id}/url?preview=false` answers `{"url": "…"}`; a plain `GET` of that URL with the same session returns the file. Not yet confirmed from a live ZJU session: if the sync reports "no download link" for every file, this is the first thing to recheck in the browser's network tab while opening a file on Courses@ZJU. Implemented in `src/sync/materials.ts`.

Mapping to our model:
- `my-courses` → **Course** (`source = "zju"`, `externalId = id`).
- `activities` with `type = homework` and `exams` → **Task** (`assignment` / `exam`, `dueAt = end_time`, `externalId = "tc:activity:{id}"` or `"tc:exam:{id}"`).
- `activities[].uploads` → **Material** (`externalId = "tc:upload:{id}"`). Sync downloads PDF, PPTX and text files (≤ 50 MB, published, from courses that have not ended) after importing the snapshot, at most 40 per run, skipping ones already downloaded or deleted by the owner.
- `todos` is a cross-check: every open item there must also exist from `activities` or `exams`.
- Implemented in `src/import/tronclass.ts`. Items that are not on the to-do list and already past are skipped; future ones get a note saying so.

## Graduate system (研究生教育管理信息系统), `https://yjsy.zju.edu.cn`

The owner is a graduate (硕博) student, so the undergraduate system (`zdbk.zju.edu.cn`, ZF software) has no record and shows an empty timetable.

Frontend: Vue app. API base: `/dataapi/`. Auth: the page's own session token (sent by the page; the spike did not read or copy it). Timetable page: `/dashboard/workplace?dm=py_grkb`.

| Endpoint | Gives | Useful fields |
|---|---|---|
| `GET /dataapi/system/sysJxrlXqsj/getJxrlByXnxq?xn=2026&xq=12&sfqr=1` | Term calendar | `kssj` (term start), `jssj` (term end), `zcs` (weeks), `pkzcs` (teaching weeks), `kszs` (exam weeks), `sysJxrlSjdList[]`: `jc` (period), `kssj`/`jssj` (HHMM as number) |
| `GET /dataapi/system/sysJxrlXqsj/queryPkxqByXnxq?xn=2026&xq=12` | Sub-terms in the term | used to pick `pkxq` |
| `GET /dataapi/py/pyKcbj/queryXskbByLoginUser?xn=2026&pkxq=13` | Student timetable | `kcbMap[weekday][period].pyKcbjSjddVOList[]`: `kcmc` (course), `bjbh` (class no.), `xm` (teacher), `xqj` (weekday 1–7), `ksjc`/`jsjc` (start/end period), `zc` (weeks, comma list), `pkxqMc` (term), `xqmc` (campus), `jxl` (building), `cdmc` (room) |
| (same response) `sjddList[]` | Courses with no fixed weekly slot, plus room notes | `kcmc`, `bjbh`, `kkxyMc`, `zjjsXm`, `bz` (free-text note, e.g. room changes), `xkzt` |

Codes seen: `xq=12` is the autumn–winter term; `pkxq=13` is autumn. Find the right values from the calendar response rather than hard-coding them.

Mapping to our model:
- Each timetable entry → **Course.meetingTimes** (`weekday`, period range converted to clock times through the calendar, `room`, `weeks`).
- Calendar `kssj` + `zc` → **ClassSession** dates (teaching week N starts on `kssj + 7·(N−1)` days).
- Match timetable courses to Courses@ZJU courses by class number: `bjbh` equals the last segment of TronClass `course_code` (e.g. `2026-13-9000001001` ↔ `9000001001`).
- `sjddList` entries with no weekly slot → **Course** with a note; their dates must be added by hand or from another source.
- Implemented in `src/import/yjsy.ts` and `src/import/run.ts`.

## Holidays and make-up days

The undergraduate notice board (also linked from the graduate system) publishes yearly holiday and make-up-day rules. They already show up in the timetable as one-off entries (e.g. `zc = "4"` on a Saturday). No separate feed found.

## PIEGL programme (public facts)

PIEGL is the Program in Innovation, Entrepreneurship and Global Leadership: an English-taught, two-year Master of Management for international students, run jointly by ZJU's International Campus and School of Management, launched in 2017. The AI prompts state this so briefs are pitched at the right level (`PROGRAM_CONTEXT` in `src/ai/brief.ts`). Sources: ZJU English newsroom and programme listings (Mastersportal, China Admissions), checked 2026-11-03.

## Not covered yet

- PIEGL programme site (no machine-readable feed found; course pages on Courses@ZJU are the source of truth).
- DingTalk and email.

# Can I bunk my classes?

A semester attendance planner with a calendar, future bunk reservations, explainable calculations, and a Node.js/Express/Mongoose backend. Import your timetable instead of typing every subject. Browser-local and authenticated account planners are separate.

## Run the full-stack prototype

Use Node.js 22 or newer. From this folder:

```powershell
npm ci
npm --prefix server ci
npm run demo:local
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). This explicit demo command launches a **real local MongoDB process**, downloads its binary on first use, and keeps demo data in ignored `server/.demo-data/`. It does not use Atlas. Sign in again after a restart. Leave the terminal running; Ctrl+C stops it.

For the assignment's Atlas connection, copy `server/.env.example` to `server/.env` if absent, replace `MONGODB_URI` with your Atlas URI and database name, generate a random `JWT_SECRET` of at least 32 characters, then run `npm start`. A local `.env` placeholder has been prepared on this laptop; it is deliberately excluded from Git. See [server setup](server/README.md) and [evaluation walkthrough](DEMO.md). No credentials belong in GitHub or Postman exports.

Open **Account & backups** to register/sign in. Login opens the account planner without uploading local data. **Open local planner** and **Open account planner** switch between independent records. **Copy local planner to account draft** prepares an explicit replacement; **Save to account** confirms the write. Account edits use manual saves, while local edits autosave. Unsaved cloud edits remain in the tab if a save fails; download the account draft before discarding/reloading. A stale revision blocks saving until the latest state is loaded. Tokens stay in memory, so page reload requires login again.

Browser records belong to their exact origin (host and port). Starting this server does not migrate attendance from an older `:4173` address; keep that old page/address available and download a backup there. Account JSON downloads are backups; automatic restore/merging is outside this prototype.

## Open in browser-local mode

From this folder, run `python -m http.server 4173 --bind 127.0.0.1`, then open [http://127.0.0.1:4173](http://127.0.0.1:4173). Use a recent browser with JavaScript and WebAssembly enabled. JavaScript modules require HTTP; opening index.html directly is unsupported.

This optional Python server serves static files only; account APIs require the Node server above. Local records use localStorage for the current browser and address. English OCR runs in a local browser worker. Imported files and extracted text are not saved or uploaded. Only reviewed subject/session records are sent when you explicitly save an account planner.

## Import workflow

1. Drop a PDF, Excel workbook (`.xlsx` or `.xls`), or image (PNG/JPEG/WebP/BMP/GIF). CSV/TSV/text and pasted tables also work. PDF scans use OCR automatically.
2. Compare detected subjects, weekdays, and start times against the original. Correct missing/merged rows. Abbreviations, rotated photos, handwriting, and unfamiliar table layouts can need manual corrections. Each row counts as one equally weighted session.
3. Enter the semester end date, the date/time through which counts are complete, and **attended** plus **held so far** for each detected subject. Missed is calculated as held minus attended. Meetings after the cutoff, including later today, populate the calendar.
4. Review and confirm. Subjects and totals are created automatically. Estimated semester total = held so far + remaining scheduled sessions. Holidays/cancellations must be corrected; inferred totals follow additions/cancellations, while postponements preserve session identity.

Counts include a meeting starting exactly at the cutoff time. Choose a cutoff before its start if the meeting has not yet been included. The importer adds new subjects and refuses duplicate names rather than overwriting history. Advanced corrections remain available below the calendar.

Limits: 15 MB per file, 20 PDF pages, 10 workbook sheets, 500 rows/100 columns per sheet, and 40 megapixel source images. English printed text is supported; convert HEIC/TIFF to PNG/JPEG. Every import requires review. The app does not infer your university's subject-code meanings, session weights, holidays, or semester end date.

## Attendance and calculations

Semester-end thresholds per subject: at least 75% is safe; 60% to below 75% incurs a grade drop; below 60% means a retake. Integer session counts decide thresholds, not rounded display percentages.

Open **Show calculations** on a subject for current attendance, derived missed sessions, whole-session 75%/60% requirements, final projections, attendance slack, usable bunk allowance, and recovery estimates. The usable allowance is capped by the number of remaining unreserved classes. Candidate bunks are alternatives, not jointly safe absences. Forecasts assume attendance at every remaining class outside the selected bunk plan.

## Reliability

Classes beyond semester end are rejected. Unmarked past sessions and unreconciled fixed totals block trusted advice. Editing a plan preserves unfinished setup drafts. Corrupt saved records are preserved until explicit replacement. Stale tabs pause saving, with Web Locks serializing saves across supported browsers; browsers without Web Locks still compare saved snapshots before writing. A view failure cannot block the persistence subscriber.

## Development

Run `npm test` for frontend tests and `npm run test:api` for real MongoDB integration tests, or `npm run test:all` for both. With the demo running, `npm run test:postman` executes the importable collection using Newman. See [Postman instructions](postman/README.md) for Postman Desktop. Tests use synthetic accounts; avoid running the collection against your real attendance account.

Pinned browser assets remain checked into `vendor/`. To recreate them, run `npm ci --ignore-scripts --omit=optional`, then `npm run prepare:vendor` (requires an internet connection for the pinned English OCR model).

Libraries: [PDF.js](https://mozilla.github.io/pdf.js/), [SheetJS CE](https://docs.sheetjs.com/docs/getting-started/installation/standalone/), and [Tesseract.js](https://github.com/naptha/tesseract.js). Versions are pinned in package-lock.json and licenses accompany vendor assets. Browser libraries were explicitly approved after the original no-library plan.

Current project details: [API contract](API_CONTRACT.md), [scope](WHAT.md), [implementation stages](HOWEXACTLY.md), [demo](DEMO.md), [QA and security verification](FULLSTACK_REPORT.md). Historical context: plan.md, spec.md, interfaces.md and UPDATE_REPORT.md describe the earlier static app.

The teacher requested a **separate public GitHub repository**. This work extends the existing repository selected by the user; teacher approval for that substitution and public visibility must be resolved before submission. Atlas verification remains pending the user's connection string.

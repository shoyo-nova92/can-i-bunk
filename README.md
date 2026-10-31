# Can I bunk my classes?

A static semester attendance planner with a calendar, future bunk reservations, and explainable calculations. Import your timetable instead of typing every subject.

## Open locally

From this folder, run `python -m http.server 4173 --bind 127.0.0.1`, then open [http://127.0.0.1:4173](http://127.0.0.1:4173). Use a recent browser with JavaScript and WebAssembly enabled. JavaScript modules require HTTP; opening index.html directly is unsupported.

The server serves static files only. There is no application backend, account, API key, document-upload service, or cross-device sync. Records are saved in localStorage for the current browser and address. English OCR runs in a local browser worker. Imported files and extracted text are not saved or uploaded; only reviewed subject/session records are stored.

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

Run `npm test` with Node.js: tests use its built-in runner. `node_modules` is unnecessary to serve the app because pinned browser assets are checked into `vendor/`. To recreate them, run `npm ci --ignore-scripts --omit=optional`, then `npm run prepare:vendor` (requires an internet connection for the pinned English OCR model).

Libraries: [PDF.js](https://mozilla.github.io/pdf.js/), [SheetJS CE](https://docs.sheetjs.com/docs/getting-started/installation/standalone/), and [Tesseract.js](https://github.com/naptha/tesseract.js). Versions are pinned in package-lock.json and licenses accompany vendor assets. Browser libraries were explicitly approved after the original no-library plan.

Project details: plan.md (requirements), spec.md (original task split), interfaces.md (module contracts), UPDATE_REPORT.md (review fixes and import verification).

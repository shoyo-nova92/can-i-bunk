# Timetable import and review fixes

Updated 2026-10-31. The user explicitly approved local browser libraries, replacing the original no-library restriction. The app still has no backend or API key.

## What changed

- PDF text extraction and scanned-PDF OCR using local PDF.js/Tesseract assets.
- Excel XLSX and legacy XLS reading using local SheetJS assets; CSV/TSV/text and pasted tables also supported.
- Printed English image OCR for PNG/JPEG/WebP/BMP/GIF. Clear conversion/error messages for unsupported image types, unreadable files, and excessive input sizes.
- Reviewable subject/day/start-time candidates before any import. Edit or remove detected meetings and add missing ones. No automatic interpretation of university course codes or double-period weights.
- Per-subject attended and held counts, derived missed count, shared semester end date, and precise date/time cutoff. Future classes later today remain in the calendar when not covered by the counts.
- Imported subjects estimate semester totals from held + remaining schedule. Calendar additions/cancellations update inferred totals; postponements retain identity and plans. Existing fixed-total subjects remain compatible.
- Visible calculations for current attendance, required whole-session counts, final projections, signed slack, capped bunk allowance, and recovery estimates.

## Review findings addressed

1. Active classes after semester end are rejected; raw inconsistent projections are marked unreliable.
2. Dirty subject/session forms survive unrelated plan updates and day refreshes. Successfully submitted forms refresh normally.
3. Percentage formatting never rounds an unsafe value up to a displayed 75.0% or 60.0%.
4. Saved snapshots are compared before writes; stale tabs pause saving. Web Locks serialize rapid and concurrent writes on supported browsers.
5. Validation requires string times, rejects malformed saved data, checks cutoff overlap, and bounds record counts. Corrupt saves are preserved for explicit recovery.
6. Regression tests are committed, covering math, saved-data failure paths, parser boundaries, calculations, and import derivation.
7. Store subscriber failures are isolated. Persistence runs independently of rendering, and view failures display a recovery message without resetting data.
8. Stable status codes replace English-label business logic. Shared text-only DOM construction removes duplicated element helpers; attendance calculation internals use descriptive names.

An additional discovered issue is fixed: a surplus cannot offer more bunks than there are unreserved classes left. Completed subjects offer zero additional bunks.

## Verification

- `npm test`: **58 passed, 0 failed**.
- `npm audit --omit=dev`: **0 reported vulnerabilities** for the pinned dependency set.
- Browser upload tests with software fixtures: text PDF, scanned PDF, PNG, XLSX, and legacy XLS each detected Mathematics, Physics, and Chemistry correctly.
- Full browser flow: imported three subjects from XLSX, entered attended/held counts, and generated 27 future sessions. Zero held classes remained valid without a fabricated current percentage.
- Show calculations substituted real counts and updated after a bunk reservation. The expanded explanation and a dirty subject-name draft both survived the update.
- Two-tab browser test: the stale tab showed paused saving; a local plan edit there did not overwrite the newer saved planner.
- Responsive checks: importer and editable review had no horizontal page overflow at a 390px viewport. The temporary override was reset after checking.
- No browser warnings/errors during file extraction checks. Raw documents and test fixtures are not included in Git; fixtures live under ignored tmp/.

## Parallel work

- `fix/file-readers`: file-readers.js and its tests.
- `fix/timetable`: timetable.js, timetable-parser.js and parser/import tests.
- `fix/calculations`: planner.js and its tests.
- Parent integration branch: reviewed all module changes, fixed core/storage/setup/calendar issues, added local vendor assets and regression tests, and performed browser verification.

## Limits

OCR supports printed English. Generic extraction cannot guarantee perfect results for every timetable layout, merged cell, photo, handwriting, or abbreviation; explicit review remains necessary. Files are processed locally and not stored. Correct remaining-session estimates require the real semester end date and adjustments for holidays or schedule changes. No user's actual timetable has been provided for layout-specific verification yet.

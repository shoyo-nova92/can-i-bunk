# Can I bunk my classes?

A browser-only semester attendance planner. Add subjects and historical attendance, build a calendar, record classes, and reserve future bunks to see which sessions become mandatory.

## Open locally

From this folder, run `python -m http.server 4173 --bind 127.0.0.1`, then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

The HTTP server only serves static files for local development. The app has no backend, libraries, account system, or network data storage. Keep the same browser and address to restore localStorage data. Opening `index.html` directly is not supported because the app uses JavaScript modules.

## Rules

Semester-end attendance is calculated separately for each subject. At least 75% avoids the specified attendance penalties; 60% to below 75% incurs a grade drop; below 60% means a retake. Whole-session counts decide thresholds, not rounded displayed percentages.

Calendar recommendations assume you attend every remaining session that is not a selected bunk. Several candidate bunks are alternatives, not a promise that you can miss them all. Reconcile the calendar total and mark past sessions before trusting a forecast. Moving a postponed class preserves its identity and plan.

## Tests

With Node.js installed, run `npm test`. Tests use Node's built-in runner; no package installation is needed. Node is only a development tool, not an app runtime requirement.

## Project map

- `plan.md`: agreed behavior and calculation examples.
- `spec.md`: task boundaries and dependencies.
- `interfaces.md`: state model and module contracts.
- `data.js`, `attendance.js`: validated state and attendance math.
- `storage.js`, `setup.js`, `calendar.js`, `planner.js`: independent feature modules.
- `app.js`, `index.html`, `styles.css`: integration and presentation.

No cross-device synchronization, timetable imports, notifications, or automatic attendance tracking are included.

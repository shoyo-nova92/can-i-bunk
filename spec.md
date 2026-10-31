# Can I bunk? — Small implementation tasks

Original task split, now implemented. Current requirements are in `plan.md`; the approved PDF/Excel/image import and review fixes are recorded in `UPDATE_REPORT.md`.

## Scope and file boundaries

Build one static, browser-only app using HTML, CSS, JavaScript, and localStorage. Include manual attendance, a monthly calendar, postponed classes, and future bunk planning. Exclude accounts, sync, backend, notifications, and automatic attendance. A later approved update adds local PDF/Excel/image timetable imports with pinned browser libraries. Apply semester-end rules per subject: **≥75% safe; ≥60% and <75% grade drop; <60% retake**.

Each task owns only the files listed below. Task 1 defines shared data shapes, public functions, and a change-notification interface in `interfaces.md`. Later tasks consume those interfaces without editing another task's files; agree any missing interface before starting dependent work. Task 6 wires the finished modules together.

### 1. Base: records and attendance math

**Files:** `data.js`, `attendance.js`, `data.test.js`, `attendance.test.js`, `interfaces.md`. **Depends on:** nothing.
**Once done:** The user can trust the counts and bunk allowance calculated from sample subjects.

- [ ] Define stable IDs, subjects, historical counts, sessions, actual attendance, separate future plans, and versioned state; validate inputs and prevent double counting.
- [ ] Implement current attendance, whole-session thresholds, allowances, deficits, and best final outcomes. Flag mismatched totals and unresolved past sessions.
- [ ] Run library-free tests for 75%/60% boundaries, rounding, zero history, independent subjects, undo, impossible recovery, and the 40-session examples in the source.

### 2. Save and restore

**File:** `storage.js`. **Depends on:** 1.
**Once done:** The user can reopen the app and recover their records and plans.

- [ ] Save and load versioned state through the agreed interface; validate loaded records.
- [ ] Handle empty, corrupt, unsupported, and unavailable storage with a clear result for the UI; never claim a failed save succeeded.

### 3. Subject setup and schedule

**File:** `setup.js`. **Depends on:** 1.
**Once done:** The user can add subjects midway through a semester and build or correct their remaining schedule.

- [ ] Provide subject, total, historical counts, weekly times, and end-date fields; generate local-date sessions from today without duplicates.
- [ ] Support adding, removing, cancelling, and postponing sessions; preserve recorded attendance and moved-session IDs/plans. Flag total mismatches and today's possible history duplicates.

### 4. Calendar and attendance

**File:** `calendar.js`. **Depends on:** 1.
**Once done:** The user can browse months, inspect today, and mark or correct each class's attendance.

- [ ] Render sessions and day details with readable text labels; support attended, missed, and undo through the shared interface.
- [ ] Highlight unmarked past sessions; display planning labels supplied by Task 5 without changing actual attendance.

### 5. Bunk choices and previews

**File:** `planner.js`. **Depends on:** 1.
**Once done:** The user can reserve future bunks and see what they must attend today or later.

- [ ] Select/clear planned bunks and supply calendar labels; immediately recalculate the affected subject. Explain that candidate bunks are alternatives, not all safe together.
- [ ] Preview today's bunk without saving it: show allowance before/after, best final percentage, mandatory sessions, and impossible plans. Qualify unreliable forecasts.

### 6. Connect and finish

**Files:** `app.js`, `index.html`, `styles.css`. **Depends on:** 2–5.
**Once done:** The user can use the complete app on a phone or desktop and retain changes after reload.

- [ ] Connect module views and shared state, load/save changes, refresh calendar/planner, and show validation/storage errors; render entered names as text.
- [ ] Check keyboard/mobile use and complete one flow: setup → attendance → future bunk → preview → postpone → undo → reload. Confirm no lost or duplicated sessions.

**Independent work:** After Task 1, Tasks **2, 3, 4, and 5 can run in any order or in parallel** using shared sample state and agreed interfaces. They do not depend on each other's implementation. Task 6 integrates them; it does not edit their files.

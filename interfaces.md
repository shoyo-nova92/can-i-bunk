# Module contract

ES modules with pinned, locally hosted import libraries. Import from `./data.js` and `./attendance.js`. Node tests: `npm test`.

State: `{version:1, subjects:[], sessions:[]}`.
Subject: `{id,name,total,attended,missed,endDate:'YYYY-MM-DD',weekly:[{day:0..6,time:'HH:MM'}]}`. Historical attended/missed are counts before generated calendar entries; total includes both. Sunday=0.
Session: `{id,subjectId,date:'YYYY-MM-DD',time:'HH:MM',actual:'unmarked'|'attended'|'missed',plan:'undecided'|'attend'|'bunk',cancelled:boolean}`. All dates local. Moving preserves ID and all other fields. No duplicate active subject/date/time slots.

`data.js`: `emptyState()`, `clone(value)`, `uid()`, `today()`, `localDate(Date)`, `validDate(string)`, `validateState(state)` (returns input or throws), `createSubject(input)` (returns validated subject), `createSession(subjectId,date,time)` (returns new session), `createStore(initial?)`, `markAttendance(store,id,actual)` (rejects future marks).

Store: `get()` returns copy; `update(draft=>{...})` clones, mutates, validates, commits, synchronously notifies subscribers; invalid updates throw and roll back. Subscriber failures are isolated and reported through optional onListenerError; they do not undo a commit or block another subscriber. `subscribe(state=>{...})` returns unsubscribe. Catch errors and show inline. UI must not subscribe internally: app.js owns subscription and calls controller.render() after changes. Preserve editing focus where possible.

`attendance.js`: `analyze(state,subjectId,asOf=today())` returns `{subjectId,N,A,M,R,B,required75,required60,mismatch,unresolved:[sessionIds],reliable,currentPercent:null|number,best,maximum,allowance,deficit,bestPercent,maximumPercent,canRecover75,canRecover60,outcome:null|'safe'|'grade-drop'|'retake',labels:{[sessionId]:string}}`. Percentages are 0..100. N=planned total. R excludes marked and cancelled sessions. B counts only unmarked noncancelled planned bunks. Inconsistent calendar or unmarked past session => unreliable; do not promise safety. `previewBunk(state,sessionId,asOf?)` returns `{before,after,mandatoryIds}` without mutation. Only upcoming unmarked classes.

## Later tasks: required exports and ownership

- Task 2 `storage.js`: `loadState(storage=localStorage)` => `{state,error:null|string}`; missing data returns empty state; invalid data returns empty state AND error without deleting the original. `saveState(state,storage=localStorage)` => `{ok:boolean,error:null|string}`. Both catch storage access errors. Use key `can-i-bunk.v1`. Do not overwrite invalid saved data until user explicitly chooses to start fresh (app handles).
- Task 3 `setup.js`: `mountSetup(root,store)` => `{render()}`; DOM module handles forms for subjects and schedule generation/corrections. Root belongs solely to setup module. UI supports editing total/history, weekly timetable, end date; add/move/cancel/remove classes. Preserve marked sessions on regeneration, avoid duplicates; explain reconciliation warnings. Never subscribe internally.
- Task 4 `calendar.js`: `mountCalendar(root,store,{getLabel,onPreview})` => `{render()}`. getLabel(session) returns string supplied by app from planner; onPreview(sessionId) calls planner. Include month navigation, selected-day details, attendance marks and undo. No importing planner.js. Root belongs to this module. Never subscribe internally.
- Task 5 `planner.js`: `getSessionLabel(state,session)` returns analyze label. `mountPlanner(root,store)` => `{render(),preview(sessionId)}`. Include subject summary, future session selector, reserve/clear bunk and plan-to-attend controls; preview with before/after/mandatory class dates. Never subscribe internally. Root belongs to this module.
- Task 6 `app.js`, `index.html`, `styles.css`: bootstrap load/store, modules, shared save/error status, reset protection, subscriptions, CSS. Agent must not modify prior module files.

DOM styling contract: use semantic elements, `section`, `form`, `label`, `input`, `select`, `button`, headings, `.field`, `.actions`, `.notice`, `.error`, `.muted`, `.subject-card`, `.session-card`. Calendar may add its own classes documented in return summary. Use textContent for user text. Safe fixed template strings allowed. No libraries/fonts/assets fetched. App's visual direction: blue/white student planner, calendar-centered workspace, serif heading + system sans body, ink #172844, blue #234ed8, pale blue #edf3ff, white #fff, green #146345, red #ab3042. Visible keyboard focus, responsive, text labels as well as colors.


## Approved import/reliability extensions

Subject may include `historyThrough` (local date), `historyThroughTime` (HH:MM), and `totalMode: 'inferred'|'fixed'`. Inferred totals recompute on updates from history plus active session count. Active classes cannot precede/overlap the history cutoff or fall after endDate. Existing records without metadata remain compatible fixed totals.

`analyze` also returns `attendanceSlack`, `outsideSemester` IDs, and `statuses` with stable codes. Labels are display text only; logic/styles use codes. Allowance is min(R-B, attendanceSlack). `formatPercent` avoids displaying 75.0/60.0 for percentages below a boundary.

`createPersistence(storage?)` exposes loaded state, paused, save, saveAsync, pause, and explicit replace. saveAsync queues rapid edits and uses Web Locks when available. Every ordinary save compares the last-read raw snapshot; stale state pauses writes. Persist before rendering, in separate subscribers.

`mountTimetable(root,store)` preserves its DOM/drafts on render. readTimetableFile reads local files on demand; parseTimetable extracts review candidates. buildTimetableImport derives new subjects/sessions with attended/held counts and cutoff date/time. Raw files/text are never persisted. `dom.js` contains the shared text-only element helper. `setup.js` retains dirty forms until successful submission, preserving in-memory drafts across view refreshes.

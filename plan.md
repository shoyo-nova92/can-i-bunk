# Can I bunk my classes?

Status: Requirements agreed in chat. This file records the design for implementation.

## Goal

Build a browser app that answers:

- Which upcoming classes can I bunk?
- If I bunk today, what must I attend later?
- If I want to bunk later, what must I attend today?

The main answer is a calendar of individual sessions. Every recommendation must account for the user's existing attendance and selected future bunks.

## Constraints

- Plain HTML, CSS, and JavaScript only.
- No backend, libraries, accounts, or external services.
- Save subjects, attendance, calendar changes, and plans in localStorage.
- Restore saved data when the browser reopens the app.
- Data belongs to the current browser and origin; this is not cross-device storage.

## Attendance rules

Attendance is assessed separately for each subject at the end of the semester.

- **75% and above:** safe from the attendance penalties described here.
- **60% to below 75%:** grade drop.
- **Below 60%:** retake the course.

Exactly 75% is safe. Exactly 60% is in the grade-drop zone. A grade drop does not automatically mean failing.

Each session has equal weight. Cancelled sessions do not count. Postponed sessions retain their identity and still count when held.

Current attendance and projected final attendance must be displayed separately. A low current percentage alone does not establish the final penalty.

## Subject and semester setup

The user enters:

- Subject name.
- Planned total sessions for the entire semester, including past sessions.
- Sessions already attended and sessions already missed.
- Weekly class days and times, supporting multiple sessions in one day.
- Semester end date.

Generate upcoming sessions from today through the semester end date, inclusive. Historical counts represent sessions before this generated schedule. If a class earlier today is already included in the starting counts, the user must remove that duplicate calendar entry before relying on projections.

The expected number of remaining sessions is:

`planned total - historical attended - historical missed`

Flag any difference between that number and the generated, non-cancelled calendar sessions. Provide controls to add, remove, or move sessions and edit the planned total. Do not silently invent dates or claim that an inconsistent schedule is verified safe.

## Session tracking

Keep actual attendance separate from future intent.

- Actual attendance: unmarked, attended, or missed.
- Future plan: undecided, plan to attend, or want to bunk.
- Cancelled sessions are excluded from attendance calculations.
- Moving a postponed session preserves its ID, attendance, and future plan.

The user marks attendance manually, class by class, and can undo or correct a mark. A planned bunk never automatically becomes an actual absence. An unmarked session in the past requires attention; it is not silently counted as attended or missed.

## Calendar and planning behavior

Show a month calendar with day details listing individual classes. Make today's classes easy to find. Each session must use text labels as well as color.

Planning labels:

- **Can choose to bunk:** this absence fits the remaining allowance, taking selected bunks into account.
- **Planned bunk:** the user has reserved an absence here.
- **Must attend for 75%:** skipping this session would make 75% impossible under the current plan.
- **Plan exceeds allowance:** the selected absences already prevent reaching 75%.
- **Needs attendance mark:** a past session is still unrecorded.

Several classes can be possible bunk choices without all being safe to miss together. Explain this beside the calendar. Selecting one must immediately update every affected session in that subject.

Allow the user to preview bunking today before committing a plan. Show the remaining allowance before and after, the best achievable final percentage, and which future sessions become mandatory.

Selecting a future bunk must update today's recommendations. Mandatory attendance is conditional on keeping the selected plan; clearing a planned bunk can restore flexibility.

## Calculation model

For a reconciled subject schedule, define:

- `N`: total counted sessions for the semester.
- `A`: historical attended plus calendar sessions marked attended.
- `M`: historical missed plus calendar sessions marked missed.
- `R`: remaining sessions with no actual attendance mark.
- `B`: sessions in R marked want to bunk.

The invariant is `N = A + M + R`. Count each session once; a session with actual attendance is no longer part of R or B.

Required attended sessions:

- To avoid a grade drop: `ceil(3 * N / 4)`.
- To avoid a retake: `ceil(3 * N / 5)`.

Calculate thresholds from counts, never rounded display percentages. For final classification, compare `4 * A >= 3 * N` and `5 * A >= 3 * N`.

Current attendance is `A / (A + M)`. If no sessions have been recorded, show “No attendance recorded.”

Best achievable final attended count under the selected bunk plan:

`A + R - B`

Additional bunk allowance while preserving 75%:

`A + R - B - ceil(3 * N / 4)`

A negative result is an attendance deficit under the plan, not a negative number of classes the user can bunk. Display the deficit explicitly.

An undecided session is a possible additional bunk if the allowance is at least one. If the allowance is zero, every remaining non-bunk session must be attended. If the allowance is negative, flag the plan as infeasible and show how many planned absences must be removed, where recovery is possible.

Also show the best achievable outcome if all remaining sessions are attended. If even that cannot reach 75%, say so clearly and show whether 60% remains achievable. Do not describe avoiding a retake as meeting the 75% target.

Projections assume all remaining non-bunk sessions are attended. They are conditional forecasts, not guarantees. Unmarked past sessions must be resolved before presenting a reliable forecast.

## Worked examples

### One absence left

For 40 total sessions, 30 attendances are needed. With 20 attended, 9 missed, and 11 remaining, one more absence is possible. Any of those 11 sessions can be a candidate. After reserving one bunk, the other 10 must be attended.

### Future plans affect today

Using the same subject, reserving a future bunk consumes the last allowance. Today's class becomes mandatory. Clearing the future bunk makes today's class a possible bunk again.

### Grade-drop recovery is impossible

For 40 sessions, with 20 attended, 11 missed, and 9 remaining, the highest possible final attendance is 29/40, or 72.5%. The app must report that 75% is unreachable, even with perfect remaining attendance. Reaching 60% is still possible.

## Persistence and validation

- Use stable IDs for subjects and sessions and a versioned localStorage format.
- Reject negative or fractional counts, zero subject totals, and historical counts exceeding the planned total.
- Validate dates and timetable entries before generating sessions.
- Avoid duplicating sessions when setup is edited or the app reloads.
- Preserve recorded attendance when editing a timetable; reconcile changes explicitly.
- Handle missing, invalid, or unavailable localStorage without silently claiming a save succeeded.
- Keep user-entered subject names as text when rendering.
- Use local calendar dates consistently so timezone conversion does not move a class to another day.

## Acceptance checks

- Exactly 75% is safe; exactly 60% avoids a retake but incurs a grade drop.
- Totals not divisible by four use the correct whole-session ceiling.
- Selecting and clearing a planned bunk immediately updates allowances and required attendance.
- Multiple candidate bunks cannot be mistaken for a jointly valid plan.
- Moving a class preserves its attendance and bunk plan without adding a session.
- Mid-semester starting counts combine with calendar marks without double counting.
- Undoing an attendance mark updates all projections.
- Calendar count mismatches and unmarked past classes are visible.
- Reloading restores the same subjects, attendance, and plans.
- Different subjects calculate allowances independently.
- The calendar remains usable on mobile and with a keyboard.

## Deliverable

Implement as static files: `index.html`, `styles.css`, and `app.js`. This specification does not implement the app.

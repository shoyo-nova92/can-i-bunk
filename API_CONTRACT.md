# Full-stack API contract

Agreed 2026-11-02 from the current frontend and the user's assignment requirements. Original supplied AGENTS.md, WHAT.md, HOWEXACTLY.md, CODEX_PROMPTS.md and custom TOML files were absent from the workspace/archive; this contract reconstructs the pasted requirements.

## Transport and authentication

Same-origin Express server serves the existing frontend and `/api`. JSON requests/responses. All attendance routes require `Authorization: Bearer <token>`. The frontend keeps tokens in memory only; reload requires sign-in. Passwords are hashed, secrets stay in ignored server/.env. Errors use `{error:{code,message}}` with appropriate 400/401/404/409/413/429/500/503 status. Validation errors are 400, duplicate email and stale revisions 409. Unknown or other-user records are 404.

- GET /api/health -> `{status:'ok',database:'connected'}` (503 when unavailable).
- POST /api/auth/register `{name,email,password}` -> 201 `{token,user:{id,name,email}}`.
- POST /api/auth/login `{email,password}` -> 200 same shape.
- GET /api/auth/me -> `{user:{id,name,email}}`.

## Planner and CRUD

Planner state is exactly the existing data.js shape `{version:1,subjects:[],sessions:[]}`; use its validateState for semantic validation and explicit allowed fields for persisted records. Client IDs remain stable strings. Each user has one MongoDB planner document with owner, revision and state. All writes atomically compare owner + revision, increment revision, and return `{state,revision}`. No upsert on a stale write. Initial empty state revision is 0. No incoming owner/_id accepted. Validate entire resulting state before saving, including reference and date/count invariants. Inferred totals must equal historical counts plus active sessions.

- GET /api/state -> `{state,revision}`.
- PUT /api/state `{state,revision}` -> `{state,revision}`. Explicit save/import only; never overwrite browser-local records.
- GET /api/subjects -> `{subjects,revision}`.
- GET /api/subjects/:id -> `{subject,revision}`.
- POST /api/subjects `{subject,revision}` -> 201 `{state,revision}`.
- PATCH /api/subjects/:id `{changes,revision}` -> `{state,revision}`; ID immutable.
- DELETE /api/subjects/:id `{revision}` -> `{state,revision}`; cascade that subject's sessions atomically.
- GET /api/sessions -> `{sessions,revision}`.
- GET /api/sessions/:id -> `{session,revision}`.
- POST /api/sessions `{session,revision}` -> 201 `{state,revision}`.
- PATCH /api/sessions/:id `{changes,revision}` -> `{state,revision}`; ID immutable.
- DELETE /api/sessions/:id `{revision}` -> `{state,revision}`.

## Frontend preservation

Local mode remains the default and keeps `can-i-bunk.v1` untouched by account actions. Account mode uses a separate store and explicit load/save controls (or autosave with clearly visible conflicts). Switching mode rebuilds/reloads safely without storing cloud records under the local key. Never auto-import local records on login. Offer explicit upload with confirmation before replacing existing cloud records. Local records and cloud records both downloadable as JSON. Network/auth/conflict failures retain unsaved state, offer retry, and never claim a successful save. Preserve all current timetable/import/calculation modules and UI.

## Completion evidence

All original tests pass; real MongoDB integration tests cover auth, two-user isolation, validation, revisions, CRUD, restart persistence; Postman collection has assertions and variable chaining. Real Atlas and Postman Desktop runs must be distinguished from automated local MongoDB/Newman tests.

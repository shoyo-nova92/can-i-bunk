# Full-stack implementation and verification

2026-11-02. This extends the existing static planner for the Node.js/Express/MongoDB assignment. Historical build/import reports remain unchanged as context.

## Delivered

- Express routes/controllers, Mongoose User/Planner models, bcrypt password hashing, two-hour JWT authentication, owner-scoped planner/subject/session CRUD and atomic revision writes.
- Same-origin frontend serving with an asset allowlist, protected private files, request limits, authentication throttling and readable API errors.
- Existing vanilla UI, browser-local persistence, timetable importer and exact attendance thresholds retained. A separate account planner supports explicit saves, intentional local-to-account copying, backups and visible conflict/error recovery.
- Four project-scoped agent profiles, API contract, scope/stages, reusable prompts, Postman collection/environment and laptop evaluation instructions.
- An ignored server/.env with an Atlas URI placeholder; user will fill it later. Explicit local-demo command launches real MongoDB7.0.24 and persists demo records separately.

## Independent review

Fresh backend_builder and frontend_integrator implemented within server/ and frontend file ownership. Fresh qa_tester and security_reviewer reviewed read-only. The lead handled contract, package scripts, documentation, Postman assets and demo coordination.

QA reproduced a cross-mode dirty-form handler bug, then confirmed the fix: view roots are cleared when changing store, while ordinary renders still preserve drafts. QA also exposed a Mongoose reconnect initialization race; model initialization is now explicit and background model creation is disabled before compilation.

Final independent QA: **62 frontend tests +7 real MongoDB integration tests pass**. Browser checks covered registration/login, local/account separation, dirty-form mode switching, account save/reload, persistence after an actual server/MongoDB restart, reviewed timetable import and calculations. An expired-token save retained the exact draft and produced a valid JSON backup. Browser warnings/errors were empty during the checked flows.

Security review found no blocking issue. Invalid JWT issuer/audience/algorithm, expiry and unsigned tokens were rejected401; owner-scoped CRUD, allowlisted inputs, atomic revisions and password hashes were checked. Prototype-pollution input was rejected without revision advance; unusual string record IDs round-tripped safely. A minor static traversal denial originally returned500; it now returns404 with regression coverage. No private file contents were exposed.

Lead verification: `npm run test:all` passes69 tests. The Postman collection passes **26 requests and37 assertions** in Newman against the running local backend. The actual **Postman Desktop12.34.4** collection runner independently completed at22:34 IST: **37 passed,0 failed,0 skipped,0 errors**, one iteration,4.424seconds. Both the collection and environment are imported in the user's workspace, with Keep variable values disabled for the run. Screenshot evidence is saved beside the repository as can-i-bunk-postman-desktop.png.

Production dependency audits in both root and server report0 vulnerabilities. Newman is dev-only; its upstream toolchain currently has19 reported advisories (7moderate,11high,1critical), so only the reviewed collection should be run. This is separate from the served browser/backend dependency audits.

## Remaining external requirements

- Atlas: intentionally unconfigured at the user's request. Actual Atlas connection/CRUD verification remains pending. The placeholder fails immediately with a readable setup message.
- Postman Desktop: verified against the local MongoDB demo; the same collection can be rerun against the app after Atlas setup.
- GitHub: user chose the existing repository, which was private at initial audit. The teacher explicitly requires a separate public repository; approval for substitution and public visibility remain unresolved. No visibility change or assignment submission is claimed.
- The tutorial page was inspected for its title; the implementation follows the assignment's listed technology/model/controller/CRUD/Postman requirements. A verbatim video-by-video reproduction is not claimed.

Start/demo and evaluation details: README.md, server/README.md, postman/README.md and DEMO.md.

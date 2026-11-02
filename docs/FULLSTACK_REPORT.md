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

## Actual Atlas verification — 2026-11-02

The user configured the existing ignored server/.env. Verification used the real Atlas cluster through the normal Express/Mongoose server, not mongodb-memory-server. No environment values, database credentials or tokens were disclosed; .env remains untracked and ignored.

- Atlas startup, model/index initialization and health HTTP200 passed using the explicit `npm run start:atlas` compatibility command.
- Independent QA: 62/62 frontend tests passed; Newman exercised all 26 saved collection requests with 37 assertions, zero failures, exit0. Registration, login, current user, planner read/save, every subject/session CRUD route, invalid counts400, missing authentication401, owner isolation404 and stale revision409 passed.
- Independent supplemental HTTP checks: 11 passed, including fresh-login persistence, rejected mass assignment and invalid counts. Tests used synthetic accounts; some synthetic accounts/fixtures remain in Atlas. No existing user records were changed.
- Lead restart check: saved a synthetic planner, stopped the Express process, restarted against Atlas, logged in afresh and compared the complete saved state and revision successfully. This establishes server restart persistence, separately from browser reload persistence.
- Postman Desktop12.34.4 rerun against Atlas at23:10 IST: 26 requests, 37 passed assertions, zero failures/skips/errors, one iteration,7.041seconds. The environment is still named Can I Bunk Local because the HTTP server runs on the laptop; its database was Atlas during this run.
- Browser registration against Atlas passed before the usage interruption. The final browser save/reload verification could not be completed because local browser control is disabled in Work settings. Earlier browser results above were against local MongoDB and are not relabeled as Atlas results.

TLS limitation: default negotiation failed with alert80 on the tested network path. Explicit TLS1.2 initially verified all three nodes and enabled full API testing. Subsequent restart attempts also intermittently failed with alert80, including one node under TLS1.2; a later restart succeeded. The cause is not proven and the compatibility command is not a guarantee of reliable startup. Certificate and hostname verification remain enabled. Before evaluation, start the server and confirm health on the actual evaluation network; investigate recurring errors with Atlas/network support rather than disabling verification.

Current readiness: Atlas API functionality and durable persistence are verified. Full evaluation readiness remains conditional on the browser save/reload check, reliable connection on the evaluation network, and teacher approval for reusing the existing repository. GitHub visibility was rechecked and is now public.

### Startup reliability follow-up

The user's own Newman output also passed26requests/37assertions, while subsequent default and TLS1.2 startup commands failed. Reproduction against unchanged credentials showed TLS1.2 connection/ping success, then alert80 failure, then success on three successive attempts. Direct verified TLS probes varied by Atlas node between attempts. This does not establish a password error or prove a specific network component is responsible.

Startup now makes at most four attempts for transient MongoDB network/server-selection failures, closes the previous connection before retrying, and waits one second between attempts. Configuration, authentication and permission failures stop immediately. Fixed diagnostic messages identify TLSalert80, DNS, authentication/permissions or network categories without echoing raw driver text. All11backend tests passed, including bounded retry, cleanup order, immediate authentication failure and credential-redaction checks. The original single-attempt database helper remains unchanged for integration-test behavior.

A live retry-helper run on the newly selected phone hotspot exhausted all four attempts with TLSalert80; hotspot IP authorization was still being confirmed. Retries improve tolerance of transient failures but do not repair an inaccessible network path. No automatic database substitution, insecure TLS setting or certificate bypass was added. User .env remains untouched.

After the user added the hotspot's current IP and confirmed Active, all three successive Atlas initialization-and-ping runs passed with zero retries. The actual `npm run start:atlas` server was restarted successfully; health returned200/databaseconnected. Newman then passed26requests/37assertions/0failures in8.2seconds on the hotspot. This comparison points toward the earlier network path as a contributor, without proving the exact router, provider, proxy or Atlas-side cause. Keep the working evaluation network and its Atlas IP entry available. Independent QA separately reran all11backend tests and reviewed bounded retries and safe diagnostics successfully.

## Remaining external requirements

- Atlas: configured and verified as recorded above; intermittent TLS startup failures remain an evaluation risk.
- Browser: finish save, reload, login and restored-record checks against Atlas; local browser automation is currently disabled.
- Postman Desktop: verified against both local MongoDB and actual Atlas in separate runs.
- GitHub: the existing repository is now public. The teacher explicitly requires a separate repository; approval for substitution remains unresolved. No assignment submission is claimed.
- The tutorial page was inspected for its title; the implementation follows the assignment's listed technology/model/controller/CRUD/Postman requirements. A verbatim video-by-video reproduction is not claimed.

Start/demo and evaluation details: README.md, server/README.md, postman/README.md and DEMO.md.

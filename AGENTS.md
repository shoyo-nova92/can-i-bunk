# Can I Bunk

Extend this existing vanilla HTML/CSS/JavaScript application with Node.js, Express, MongoDB Atlas and Mongoose for the backend assignment. API_CONTRACT.md is the agreed transport and persistence contract. WHAT.md defines completion; HOWEXACTLY.md explains implementation and demonstration.

## Ownership

The technical lead coordinates the API, integration, package scripts, Postman collection and evaluation documentation. Delegate implementation to fresh backend_builder (server/ only) and frontend_integrator (frontend only). After integration, delegate independent checks to qa_tester and security_reviewer, both read-only. Reviewers send reproducible findings to the lead; builders fix their own files. Run QA again after material fixes.

## Preservation

Keep the existing UI and attendance rules, including exact 75%/60% boundaries, importer review, inferred totals, postponed-session identity and protected local saves. Account operations must leave can-i-bunk.v1 untouched. Import local attendance into an account only by explicit user action. Preserve unsaved edits on failed requests and stale revisions. Imported source documents continue to be processed in the browser.

## Backend

Use controllers/routes and Mongoose models, owner-scoped queries, password hashing, authenticated attendance routes, bounded allowlisted inputs and atomic revision checks. Preserve client subject/session IDs. Never commit credentials or .env files. Serve public frontend assets from an allowlist, keeping backend files, Git metadata and configuration private. Use a real MongoDB server in automated integration tests. mongodb-memory-server is a test/demo launcher, not the required Atlas service.

## Verification and reporting

Run original tests, API integration tests, Postman collection assertions, browser flows and independent QA/security reviews. Distinguish tested local MongoDB from an actual Atlas connection, and Newman from Postman Desktop. Record remaining user setup honestly. The assignment explicitly requests a separate public GitHub repository; the existing repository does not satisfy that rule without teacher approval. Do not assert approval or change repository visibility without user authorization.

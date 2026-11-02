# Reusable project prompts

## Prompt 1 — audit and contract

Read AGENTS.md, WHAT.md, HOWEXACTLY.md, API_CONTRACT.md and the four .codex/agents definitions. Read the historical reports and audit the current code. Run existing tests. Report baseline, persistence safeguards, agreed API contract, file ownership and stages before substantial implementation.

## Prompt 2 — implement

Act as technical lead. Delegate to fresh backend_builder and frontend_integrator with exclusive ownership. Implement API_CONTRACT.md while preserving existing local records and attendance behavior. Supply reproducible MongoDB tests, Postman assets and evaluation instructions. Keep the user's Atlas URI in ignored server/.env and report environment prerequisites separately from code completion.

## Prompt 3 — independent verification

After integration, delegate to fresh read-only qa_tester and security_reviewer. Verify auth, CRUD, two-account isolation, invalid inputs, revision conflicts, browser flows, original calculations, importer and record preservation. Report reproducible failures and exact test evidence. Builders fix their own files; rerun affected QA before declaring readiness. Distinguish Atlas from local MongoDB and Postman Desktop from Newman.

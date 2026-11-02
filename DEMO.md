# Laptop evaluation walkthrough

## Before the evaluation

Run `npm ci` and `npm --prefix server ci` once. For a quick local demonstration run `npm run demo:local`, then open http://127.0.0.1:3000. This is local MongoDB, not Atlas. For the assignment, configure the Atlas placeholder in ignored `server/.env` and use `npm start` instead. Atlas needs a database user, your current network IP allowed, and a URI with a database name. URL-encode special characters in the database password. Keep the real URI private.

Run `npm run test:all`. With the server running, run `npm run test:postman`. Import the two JSON assets from `postman/` into Postman Desktop and select the local environment. Run the collection in order and show its assertion results. Export neither credentials nor populated tokens.

## Five-minute demonstration

1. Show `server/package.json`: Express handles HTTP, Mongoose defines database records, bcrypt hashes passwords, JWT authenticates subsequent requests. Node executes the server; browser JavaScript remains vanilla.
2. Show `server/src/models.js`: User stores a hash, never a plaintext password. Planner stores an owner, revision and embedded subject/session records. Keeping the planner together makes consistent revisions and subject/session cascade deletion a single atomic MongoDB write. This aggregate suits a bounded student planner (300 subjects/25,000 sessions).
3. In Postman Desktop, show health, register, login and current user. Explain the bearer Authorization header. Run subject/session Create, Read, Update, Delete requests and show stored values/revisions. Show invalid counts400, missing auth401, cross-account access404, and stale revision409. Request scripts assert statuses and chain revisions.
4. In the UI, open Account & backups and sign in with a synthetic account. Use example data in an empty planner or import a timetable and review its extracted rows. Account changes remain a draft until Save to account succeeds. Reload and log in again to show database persistence.
5. Open local planner and show that it remains independent. Copying local records into the account requires explicit confirmation and Save to account. Download backups before discarding unsaved work.
6. Show calculations: whole-session requirements use `ceil(0.75 * total)` and `ceil(0.60 * total)`. Bunk forecasts assume attendance at other remaining sessions; choosing one absence can make other sessions mandatory. Unmarked past sessions or inconsistent fixed totals suspend trusted advice. Raw timetable files remain in the browser.

## Explain one request end to end

`POST /api/subjects` enters routes.js, verifies JWT/user, calls the planner controller, validates allowed fields and the resulting complete state, and writes with an owner+revision filter. MongoDB increments revision only if that filter matches. A stale request returns409, preserving the server's newer records. The frontend retains its draft and offers a backup rather than silently overwriting it.

## Honest submission checklist

- Atlas URI: the user requested a placeholder; paste a real URI and rerun health/CRUD against Atlas before evaluation.
- Repository: the user selected the existing can-i-bunk repository, currently private at initial audit. The assignment requests a separate public repository. Obtain teacher approval for reuse or prepare a separate public submission; ensure the submitted URL is publicly readable.
- Postman Desktop: use the actual desktop app and collection runner for the teacher's requirement. Newman results alone are automated collection evidence.
- Tutorial: the supplied link is titled [Intro to Backend Web Development – Node.js & Express Tutorial for Beginners](https://www.youtube.com/watch?v=KOutPbKc9UM). This project applies the assignment's listed CRUD/model/controller/testing requirements to the existing planner. It is not a claim of a verbatim reproduction of every tutorial step.

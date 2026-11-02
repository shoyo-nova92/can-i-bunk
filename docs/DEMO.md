# Laptop evaluation walkthrough

## Before the evaluation

### Repeat the actual Atlas test on this laptop

From the repository folder, run `npm run start:atlas` and keep that terminal open. This uses the existing server/.env and a TLS1.2 compatibility setting with certificate and hostname checks enabled. Do not use `demo:local` when demonstrating Atlas. The laptop/network has shown intermittent TLS alert80 failures even with this compatibility setting; if startup fails, check Atlas Network Access for the current IP and investigate the network/TLS path. A successful prior run does not guarantee connection on a different network.

1. Open http://127.0.0.1:3000/api/health. Expect status `ok` and database `connected`.
2. In a second terminal run `npm run test:postman`. Expect26requests,37assertions and0failures. This creates synthetic accounts on Atlas.
3. In Postman Desktop select the imported Can I Bunk collection and Can I Bunk Local environment, choose Run / Functional / Local /1iteration, disable Keep variable values, and run all requests. The environment name refers to the laptop HTTP address, not the database location. Actual Atlas desktop run on2026-11-02 at23:10IST passed37/37 assertions with0errors in7.041seconds.
4. Open http://127.0.0.1:3000. Register a test account, choose Try example data in its empty account planner, click Save to account, and wait for confirmation. Reload, sign in again, and confirm the subject/session records return. This final Atlas browser save/reload check remains manual because local browser automation is disabled in Work settings. Atlas browser registration and independent HTTP/server-restart persistence have passed.
5. Stop and restart the server, then repeat login/load. The lead already verified exact state/revision preservation through a real Express restart against Atlas. Local browser records must remain separate.

Never paste the Atlas connection string, JWT secret, bearer tokens or real passwords into screenshots, reports or GitHub. server/.env remains ignored.

Startup now retries transient database-network failures up to four times with a one-second pause and connection cleanup. Wait for the actual running/connected message before opening Postman. If all attempts fail, the command exits with a categorized diagnostic; do not treat retry logging as a successful connection. On a phone hotspot or other new network, add that connection's current IP to Atlas Network Access and wait for Active before retrying. If alert80 persists, the network/TLS cause remains unresolved; a passing earlier collection does not establish reliable startup.

Latest verified working setup: phone hotspot with its current IP marked Active in Atlas, then `npm run start:atlas`. Three independent connection/ping runs passed without retry, the app restarted successfully, and the full Postman collection passed26requests/37assertions. Use this setup for the laptop demonstration; changing networks can require a new Atlas IP entry.

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

- Atlas: configured. Actual registration/login/all CRUD/Postman and server-restart persistence passed; intermittent TLS startup reliability and the final browser reload check remain as described above.
- Repository: the existing can-i-bunk repository is now public. The assignment requests a separate public repository. Obtain teacher approval for reuse or prepare a separate public submission.
- Postman Desktop: use the actual desktop app and collection runner for the teacher's requirement. Newman results alone are automated collection evidence.
- Tutorial: the supplied link is titled [Intro to Backend Web Development – Node.js & Express Tutorial for Beginners](https://www.youtube.com/watch?v=KOutPbKc9UM). This project applies the assignment's listed CRUD/model/controller/testing requirements to the existing planner. It is not a claim of a verbatim reproduction of every tutorial step.

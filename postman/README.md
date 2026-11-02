# Postman verification

Import `Can-I-Bunk.postman_collection.json` and `Local.postman_environment.json` into **Postman Desktop**. Select the Can I Bunk Local environment. Start the app with `npm run demo:local` (or `npm start` after Atlas setup), then run the collection in its listed order, once.

The collection uses `baseUrl=http://127.0.0.1:3000`. Its first request generates synthetic email addresses, password and subject/session IDs. Registration/login capture bearer tokens; successful writes advance `revision`. Requests cover auth, both resource CRUD flows, full planner saves, invalid counts, unauthenticated requests, stale writes, two-account isolation and deletion. Final requests remove synthetic attendance records; the two synthetic user accounts remain in the demo/test database. Use a disposable database for repeated evaluation runs.

Never export populated runtime variables or a real password/token. Checked-in assets contain no credentials. No raw timetable document is uploaded.

For automated collection execution, run `npm run test:postman` with the server running. Newman is a dev-only Postman collection runner, not Postman Desktop. Its upstream dependencies currently carry audit advisories; only run this reviewed collection. `npm audit --omit=dev` checks the browser production dependencies independently. The Express server has its own dependency lock and audit.

To rebuild the collection after intentional contract changes: `node postman/generate-collection.mjs`, then rerun its assertions. To target another local server, change the environment's baseUrl; database connection remains server-side in `.env`.

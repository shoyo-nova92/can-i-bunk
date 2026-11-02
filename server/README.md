# Can I Bunk API

This Express API stores accounts and per-account planners in MongoDB through Mongoose. The existing vanilla JavaScript frontend is served from an explicit public-file whitelist. The authoritative endpoint contract is `../API_CONTRACT.md`.

## Atlas

1. Run `npm ci` in this directory with Node.js 22 or newer.
2. Copy `.env.example` to `.env` if a local file does not already exist. Replace `MONGODB_URI` with your Atlas connection string and set a generated `JWT_SECRET` of at least 32 characters. The local file is ignored by Git.
3. In Atlas, create a database user with read/write access to this application's database and add your laptop's current public IP to Network Access.
4. Run `npm start`, then open `http://127.0.0.1:3000`. Startup waits for MongoDB and its unique indexes before listening. `/api/health` reports connection readiness.

On the current laptop, Atlas connections using Node's default TLS negotiation returned alert 80, while explicit TLS 1.2 connected successfully. For this compatibility case, run `npm run start:atlas` from this directory. It starts the same server with `node --tls-max-v1.2 src/index.js`; certificate and hostname validation remain enabled. The default `npm start` command is unchanged. This is an explicit compatibility command, with no automatic retry or certificate-validation bypass.

Passwords use bcrypt with a cost of 12. Passwords require at least 10 characters and at most 72 UTF-8 bytes. Access tokens expire after two hours and are checked for issuer, audience, algorithm and account existence. Every planner query is scoped to the authenticated account. Revision checks use one atomic MongoDB update and return HTTP 409 for stale saves.

## Local demonstration and tests

`npm run demo:local` explicitly starts a real local MongoDB process using `mongodb-memory-server`, then runs the same API at port 3000. This is **not an Atlas connection**. It retains the local demonstration database in ignored `.demo-data/`; signing in again is required after a restart because the demo generates a temporary signing secret. First use may download MongoDB. Stop with Ctrl+C so the database closes cleanly. This command requires development dependencies and is only for your laptop.

`npm test` runs automated HTTP integration tests against an isolated real local MongoDB process. It verifies authentication, password hashing, CRUD, two-user isolation, invalid input, conflicting/concurrent saves, reconnect persistence, static-file restrictions and authentication rate limits. It does not claim Atlas or Postman Desktop verification. Test databases are independent of `.demo-data/` and Atlas.

Imported documents remain in the browser; the API receives only reviewed planner records. Whole-state saves validate the existing state format and inferred totals. Individual CRUD operations validate the resulting planner and recalculate inferred totals. Deleting a subject atomically deletes its sessions within the same planner document, so no multi-document transaction is necessary.

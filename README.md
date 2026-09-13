# Snake — a full-stack learning project

A small, deliberately "real-world-shaped" Snake game: session-based auth
backed by PostgreSQL, a protected game route, a canvas game, and a
leaderboard. The code is intentionally small, but the *structure* is the
same shape you'd find in a production Node/Express service, so each layer
below maps to a section of the codebase.

```
.
├── schema.sql              # users, scores, session tables (source of truth for the DB)
├── .env.example             # documents required secrets — copy to .env, never commit .env
├── Dockerfile                # packages the app for any container host
├── render.yaml                # one-click deploy: web service + free Postgres, on Render
├── scripts/init-db.js          # applies schema.sql to DATABASE_URL
├── src/
│   ├── server.js                # entry point: loads .env, starts the HTTP listener
│   ├── app.js                    # wires middleware + routes into one Express app (no listen())
│   ├── db/pool.js                  # one shared pg connection pool
│   ├── middleware/
│   │   ├── requireAuthPage.js        # protects HTML routes (redirects to /login.html)
│   │   └── requireAuthApi.js          # protects JSON routes (401 response)
│   ├── routes/
│   │   ├── auth.routes.js              # register, login, logout, /me
│   │   ├── scores.routes.js             # leaderboard (GET), score submission (POST, protected)
│   │   └── game.routes.js                # GET /game — the one page that requires login
│   ├── utils/validate.js                  # hand-rolled input validation, unit-testable in isolation
│   └── views/game.html                     # the protected page (deliberately outside public/)
├── public/                                   # served as static files, open to anyone
│   ├── index.html, login.html, register.html
│   ├── css/style.css
│   └── js/{login,register,leaderboard,game}.js
└── tests/
    ├── validate.test.js                        # unit tests, no DB/HTTP
    └── app.test.js                               # supertest against the app, no live DB needed
```

Why `app.js` and `server.js` are separate: tests import `app.js` directly
and drive it in-process with supertest, without binding a real port or
needing a live database for every test. `server.js` is the only file that
actually calls `app.listen()`.

---

## 1. Requirements

**Functional**
- A visitor can register an account and log in.
- A logged-in user can play Snake in the browser.
- A logged-in user's game score is saved to the database.
- Anyone can view a public leaderboard of best scores.
- `/game` is only reachable while logged in.

**Non-functional**
- Passwords are never stored or logged in plain text.
- Sessions survive a server restart (stored in Postgres, not in memory).
- Basic protection against SQL injection, XSS, brute-force login attempts,
  and session fixation (see [Security](#5-security)).
- The app should run identically via `npm start` and inside Docker, and be
  deployable to a free-tier host (Render) with one config file.

**Explicitly out of scope** (a real product would need these; noted so you
know where the edges are):
- Password reset / email verification.
- Anti-cheat for scores (see the comment in `scores.routes.js` — the score
  is client-reported).
- CSRF tokens (mitigated instead by `SameSite=Lax` cookies — see Security).
- Horizontal scaling concerns beyond "sessions live in Postgres, not
  in-process memory," which is what actually makes multiple server
  instances possible.

## 2. Architecture

```
Browser (canvas game, plain JS)
   │  fetch() with credentials (cookies)
   ▼
Express app (src/app.js)
   │  helmet → session → static files → routes → error handler
   ▼
Routes ──requireAuthApi/Page──► session says who's logged in
   │
   ▼
pg.Pool (src/db/pool.js) ──► PostgreSQL
                              ├── users     (accounts)
                              ├── scores    (append-only game history)
                              └── session   (express-session storage, via connect-pg-simple)
```

Request flow for "submit a score": browser posts `{score}` to
`POST /api/scores` → `requireAuthApi` checks `req.session.userId` (no DB hit
if there's no session cookie at all) → `validateScore` rejects nonsense
input → `INSERT INTO scores` with the user id **from the session**, never
from the request body, so a player can't submit a score as someone else.

The frontend is intentionally framework-free: three static HTML pages plus
a handful of small JS files talking to the API with `fetch`. No build step,
no bundler — you can open any file and read exactly what runs in the
browser.

## 3. Data model (`schema.sql`)

- **users**: one row per account. `password_hash` is a 60-character bcrypt
  hash, never the raw password.
- **scores**: append-only — every game played gets a row, not just the
  best one. The leaderboard query aggregates with `MAX(score)` grouped by
  user. Keeping full history costs almost nothing and means you can change
  your mind later (e.g. "top score this week") without having thrown data
  away.
- **session**: owned by `connect-pg-simple`, not by our own code — its
  shape (`sid`, `sess`, `expire`) is dictated by that library.

Apply it with `npm run db:init` (reads `schema.sql`, runs it against
`DATABASE_URL`). Every statement uses `IF NOT EXISTS` / a guarded `DO`
block, so re-running it is harmless — a small taste of what a real
migration tool (Knex, Prisma Migrate, Flyway...) does for you automatically
across many changes over time.

## 4. Auth

Sessions, not JWTs: on login the server creates a session row in Postgres
and gives the browser an opaque, signed cookie (`sid`) that just points at
that row. This means:
- Logging out server-side (`req.session.destroy`) actually revokes access
  immediately — nothing to blocklist.
- The client never sees or handles a token; the httpOnly cookie is
  invisible to JavaScript, which closes off a whole class of XSS-driven
  token theft.
- Storing sessions in Postgres (via `connect-pg-simple`) instead of the
  default in-memory store means sessions survive a restart/redeploy and
  work correctly if you ever run more than one server instance.

`req.session.regenerate()` is called on both register and login, issuing a
fresh session id at the moment a user's privilege level changes. This
prevents **session fixation**: without it, an attacker who tricks a victim
into using a session id the attacker already knows could inherit that
session once the victim logs in.

## 5. Security

A deliberately explicit list — each one maps to a line of code, so you can
go trace it:

| Concern | Mitigation | Where |
|---|---|---|
| SQL injection | Every query uses parameterized placeholders (`$1, $2, ...`), never string concatenation | `routes/*.js` |
| Plain-text passwords | bcrypt, 12 salt rounds | `routes/auth.routes.js` |
| Username enumeration via login timing | `bcrypt.compare` always runs, even for a nonexistent user, against a dummy hash | `routes/auth.routes.js` |
| Session fixation | `session.regenerate()` on login/register | `routes/auth.routes.js` |
| Cookie theft via XSS | `httpOnly` cookie — inaccessible to JS | `app.js` |
| Cookie theft over plain HTTP | `secure: true` in production (HTTPS-only) | `app.js` |
| CSRF | `SameSite=Lax` blocks the cookie on cross-site POSTs from other origins | `app.js` |
| Brute-force login/registration | `express-rate-limit`, 20 attempts / 15 min / IP | `routes/auth.routes.js` |
| Clickjacking, MIME-sniffing, etc. | `helmet()` default security headers | `app.js` |
| XSS via leaderboard names | Rendered with `textContent`, never `innerHTML` | `public/js/leaderboard.js` |
| Garbage/oversized input | Manual validation on username/email/password/score before any DB call | `utils/validate.js` |
| Acting as another user | User id always comes from `req.session`, never from the request body | `routes/scores.routes.js` |
| Leaking internals on error | Central error handler logs server-side, returns a generic JSON message | `app.js` |
| Non-root container | Dockerfile creates and switches to an unprivileged user | `Dockerfile` |

Known, deliberate gap: score submission trusts the client's reported score
(see the comment in `scores.routes.js`). Closing that fully requires either
simulating the game server-side or validating a signed replay — both
overkill for a learning project, but worth knowing the honest limitation
of what's here.

## 6. Testing

`tests/validate.test.js` — pure unit tests for `utils/validate.js`. No
Express, no database, just inputs and assertions. This is the cheapest,
fastest layer of tests and where most edge-case logic should live.

`tests/app.test.js` — integration-style tests using `supertest` against the
real `app.js`, but **without a live database**. That's possible because:
`pg.Pool` connects lazily (opening a real connection only when a query
runs), and an anonymous request has no session cookie, so
`express-session` never touches the Postgres-backed session store. That
lets us test routing, auth guards, and validation without standing up
Postgres in CI — a real project would add a second suite that runs against
a real (test) database for the parts that actually hit it (e.g. spin up
Postgres as a CI service container, or use something like `testcontainers`).

Run tests:
```
npm test
```

## 7. Local development

```
npm install
cp .env.example .env        # then fill in DATABASE_URL and SESSION_SECRET
npm run db:init              # applies schema.sql
npm run dev                   # node --watch, restarts on file changes
```

Generate a session secret:
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 8. Packaging (Docker)

```
docker build -t snake-game .
docker run -p 3000:3000 --env-file .env snake-game
```

The image installs only production dependencies (`npm ci --omit=dev`),
copies just the runtime files it needs (`src/`, `public/`, `scripts/`,
`schema.sql`), and runs as a non-root user. It does **not** run the app
against its own local Postgres — point `DATABASE_URL` at a real database
(local, containerized, or hosted).

## 9. Deployment (Render, free tier)

`render.yaml` is a Render "Blueprint": it provisions a free PostgreSQL
database and a free web service together, wires `DATABASE_URL` from the
database into the web service automatically, and generates a random
`SESSION_SECRET` for you.

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, point it at the repo. Render reads
   `render.yaml` and provisions both resources.
3. After the first deploy, apply the schema once against the new database
   (from your machine, with `DATABASE_URL` copied from the Render
   dashboard, or from a Render shell on the service):
   ```
   npm run db:init
   ```
4. Visit the deployed URL — `/health` should report `{"status":"ok"}`.

Render's free web services spin down when idle and cold-start on the next
request, and the free Postgres plan expires after a fixed number of days —
fine for learning/demo purposes, not for anything you need to stay up.

## 10. Operating it (what to look at once it's live)

- `GET /health` — liveness only, doesn't touch the DB. Point an uptime
  check here.
- Server-side errors are logged with `console.error` in the central error
  handler (`app.js`) — on Render these land in the service's Logs tab.
- If logins start failing en masse, check the `session` table isn't
  filling up unboundedly: `connect-pg-simple` prunes expired sessions
  periodically, but a long-idle instance can accumulate stale rows.
- The leaderboard query (`scores.routes.js`) does a `GROUP BY` + `MAX` over
  the whole `scores` table on every request. Fine at this scale; if
  `scores` ever got large you'd cache the leaderboard or maintain a
  materialized "best score per user" table updated on insert instead of
  aggregating live every time.

---

## Attribution

Built with [Claude Code](https://claude.com/claude-code).

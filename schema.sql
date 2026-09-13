-- Schema for the Snake game app.
-- Apply with: npm run db:init  (or: psql "$DATABASE_URL" -f schema.sql)
-- Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- users: one row per registered player. Passwords are never stored in plain
-- text -- password_hash holds a bcrypt hash (60 chars) generated at register
-- time.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(30) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(60) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- scores: append-only history of every game played. We keep every game
-- (not just the best one) so the leaderboard query can aggregate however we
-- like later (best score, most recent, average, etc.) without losing data.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scores (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL CHECK (score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores (user_id);
CREATE INDEX IF NOT EXISTS idx_scores_score    ON scores (score DESC);

-- ---------------------------------------------------------------------------
-- session: required by connect-pg-simple to store express-session data
-- server-side (only an opaque session id is kept in the browser cookie).
-- This is the exact table shape connect-pg-simple expects; see its docs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "session" (
  "sid"    varchar      NOT NULL COLLATE "default",
  "sess"   json         NOT NULL,
  "expire" timestamp(6) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey'
  ) THEN
    ALTER TABLE "session"
      ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

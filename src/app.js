const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const pool = require('./db/pool');
const authRoutes = require('./routes/auth.routes');
const scoresRoutes = require('./routes/scores.routes');
const gameRoutes = require('./routes/game.routes');

const app = express();

// Render (and most PaaS providers) sit behind a reverse proxy. Without this,
// Express can't tell the original request was HTTPS, and secure cookies
// would never get set in production.
app.set('trust proxy', 1);

// Sets a battery of security-related HTTP response headers (CSP, no-sniff,
// frameguard, etc.) with sane defaults. Safe here because we serve no
// inline scripts and pull nothing from third-party origins.
app.use(helmet());

app.use(express.json());

app.use(
  session({
    store: new pgSession({ pool, tableName: 'session' }),
    name: 'sid', // don't advertise "connect.sid" (the default), which fingerprints the framework
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // inaccessible to client-side JS -- mitigates cookie theft via XSS
      secure: process.env.NODE_ENV === 'production', // only sent over HTTPS in production
      sameSite: 'lax', // blocks the cookie being sent on most cross-site requests (CSRF mitigation)
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// Static assets: landing page, login/register forms, css, client-side JS.
// game.html is NOT in here -- see src/routes/game.routes.js.
app.use(express.static(path.join(__dirname, '..', 'public')));

// Liveness check for Docker/Render. Deliberately does not touch the
// database, so it stays fast and simple, and works even if the DB is
// briefly unreachable (that's a separate "readiness" concern).
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/api', scoresRoutes);
app.use(gameRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler -- every route above forwards errors here via
// next(err) instead of leaking stack traces or DB error details to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

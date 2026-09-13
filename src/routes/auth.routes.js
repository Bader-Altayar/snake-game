const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const requireAuthApi = require('../middleware/requireAuthApi');
const { validateUsername, validateEmail, validatePassword } = require('../utils/validate');

const router = express.Router();

const BCRYPT_ROUNDS = 12;

// A dummy hash used to keep login's response time roughly constant whether
// or not the username exists, so an attacker can't use timing to enumerate
// valid usernames. See the login handler below. Computed once at startup
// rather than hardcoded so it's guaranteed to be a valid bcrypt hash.
const DUMMY_HASH = bcrypt.hashSync('no-such-user-placeholder', BCRYPT_ROUNDS);

// Applied to both register and login: slows down brute-force / credential
// stuffing attempts without needing a CAPTCHA or external service.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' },
});

router.post('/register', authLimiter, async (req, res, next) => {
  const { username, email, password } = req.body || {};

  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters: letters, numbers, underscore.' });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Parameterized query -- values are never concatenated into the SQL
    // string, so user input can't be interpreted as SQL (prevents injection).
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username',
      [username, email, passwordHash]
    );
    const user = result.rows[0];

    // Regenerate the session id on privilege change (here: becoming logged
    // in) to prevent session fixation attacks.
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.username = user.username;
      res.status(201).json({ id: user.id, username: user.username });
    });
  } catch (err) {
    if (err.code === '23505') {
      // unique_violation on username or email
      return res.status(409).json({ error: 'That username or email is already taken.' });
    }
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  const { username, password } = req.body || {};

  if (!validateUsername(username) || !validatePassword(password)) {
    return res.status(400).json({ error: 'Invalid username or password.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );
    const user = result.rows[0];

    // Always run bcrypt.compare, even for a nonexistent user, against a
    // dummy hash -- this keeps timing consistent between "no such user" and
    // "wrong password" so a login attempt can't be used to probe which
    // usernames exist.
    const hashToCheck = user ? user.password_hash : DUMMY_HASH;
    const passwordMatches = await bcrypt.compare(password, hashToCheck);

    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.username = user.username;
      res.json({ id: user.id, username: user.username });
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sid');
    res.status(204).end();
  });
});

router.get('/me', requireAuthApi, (req, res) => {
  res.json({ id: req.session.userId, username: req.session.username });
});

module.exports = router;

// Hand-rolled input validation. Kept dependency-free and synchronous so it's
// trivial to unit test in isolation from Express or the database.

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateUsername(username) {
  return typeof username === 'string' && USERNAME_RE.test(username);
}

function validateEmail(email) {
  return typeof email === 'string' && email.length <= 255 && EMAIL_RE.test(email);
}

function validatePassword(password) {
  // bcrypt silently truncates input beyond 72 bytes, so we cap it there.
  return typeof password === 'string' && password.length >= 8 && password.length <= 72;
}

function validateScore(score) {
  return Number.isInteger(score) && score >= 0 && score <= 1_000_000;
}

module.exports = { validateUsername, validateEmail, validatePassword, validateScore };

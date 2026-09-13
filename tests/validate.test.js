// Unit tests: pure functions, no DB or HTTP server involved.
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateUsername, validateEmail, validatePassword, validateScore } = require('../src/utils/validate');

test('validateUsername accepts 3-20 alphanumeric/underscore chars', () => {
  assert.equal(validateUsername('bob_42'), true);
  assert.equal(validateUsername('ab'), false); // too short
  assert.equal(validateUsername('a'.repeat(21)), false); // too long
  assert.equal(validateUsername('bad name!'), false); // invalid chars
});

test('validateEmail requires a plausible email shape', () => {
  assert.equal(validateEmail('player@example.com'), true);
  assert.equal(validateEmail('not-an-email'), false);
  assert.equal(validateEmail(''), false);
});

test('validatePassword enforces the 8-72 char bcrypt-friendly range', () => {
  assert.equal(validatePassword('longenough'), true);
  assert.equal(validatePassword('short'), false);
  assert.equal(validatePassword('x'.repeat(73)), false);
});

test('validateScore only accepts sane non-negative integers', () => {
  assert.equal(validateScore(0), true);
  assert.equal(validateScore(150), true);
  assert.equal(validateScore(-5), false);
  assert.equal(validateScore(1.5), false);
  assert.equal(validateScore(10_000_000), false);
});

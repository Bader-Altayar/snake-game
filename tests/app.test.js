// Integration-style tests against the Express app via supertest, without a
// live database. This works because:
//  - pg.Pool connects lazily (see src/db/pool.js), so requiring the app
//    never opens a real connection.
//  - None of the routes below need to touch the database: an anonymous
//    request has no session cookie, so express-session never calls the
//    Postgres-backed session store (see the comment in src/app.js).
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-for-node-test-runner';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

test('GET /health reports ok without touching the database', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('GET /game redirects an anonymous visitor to the login page', async () => {
  const res = await request(app).get('/game');
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/login.html');
});

test('POST /api/scores rejects an anonymous request with 401 JSON', async () => {
  const res = await request(app).post('/api/scores').send({ score: 100 });
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Not authenticated');
});

test('POST /auth/register rejects an invalid payload before touching the database', async () => {
  const res = await request(app)
    .post('/auth/register')
    .send({ username: 'a', email: 'not-an-email', password: 'short' });
  assert.equal(res.status, 400);
  assert.ok(res.body.error);
});

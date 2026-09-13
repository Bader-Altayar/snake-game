const express = require('express');
const pool = require('../db/pool');
const requireAuthApi = require('../middleware/requireAuthApi');
const { validateScore } = require('../utils/validate');

const router = express.Router();

const LEADERBOARD_SIZE = 10;

// Public: anyone (logged in or not) can view the leaderboard.
router.get('/scores', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.username, MAX(s.score) AS best_score
       FROM scores s
       JOIN users u ON u.id = s.user_id
       GROUP BY u.username
       ORDER BY best_score DESC
       LIMIT $1`,
      [LEADERBOARD_SIZE]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Protected: only a logged-in player can submit a score, and it's always
// attributed to whoever the session says is logged in -- never to a
// user id supplied by the client.
//
// Note: the score itself is still client-reported (the browser tells the
// server how many points it earned). That's fine for a learning project,
// but a production leaderboard would need server-side game simulation or
// signed replay validation to stop a modified client from cheating.
router.post('/scores', requireAuthApi, async (req, res, next) => {
  const score = Number(req.body && req.body.score);

  if (!validateScore(score)) {
    return res.status(400).json({ error: 'Score must be an integer between 0 and 1,000,000.' });
  }

  try {
    await pool.query('INSERT INTO scores (user_id, score) VALUES ($1, $2)', [req.session.userId, score]);
    res.status(201).json({ score });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const path = require('path');
const requireAuthPage = require('../middleware/requireAuthPage');

const router = express.Router();

// game.html deliberately lives outside public/ (which is served statically
// to anyone) so the only way to reach it is through this route, which
// checks the session first. Serving it from the static folder would make
// the "protect the game route" requirement unenforceable.
router.get('/game', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'game.html'));
});

module.exports = router;

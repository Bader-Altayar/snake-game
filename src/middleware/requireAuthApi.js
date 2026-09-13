// Guards JSON API routes. An unauthenticated caller gets a 401 with a JSON
// body -- there's no page to redirect a fetch() call to.
function requireAuthApi(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated' });
}

module.exports = requireAuthApi;

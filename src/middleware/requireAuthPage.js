// Guards full-page (HTML) routes. An unauthenticated visitor is sent to the
// login page rather than shown a bare 401, since a browser navigated here.
function requireAuthPage(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect('/login.html');
}

module.exports = requireAuthPage;

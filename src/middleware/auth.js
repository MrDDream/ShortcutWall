// Lets every view know whether an admin is signed in (header menu, wall).
function exposeAuthState(req, res, next) {
  res.locals.isAuthenticated = Boolean(req.session?.isAuthenticated);
  next();
}

function ensureAuthenticated(req, res, next) {
  if (req.session?.isAuthenticated) {
    return next();
  }
  return res.redirect('/admin/login');
}

module.exports = { ensureAuthenticated, exposeAuthState };

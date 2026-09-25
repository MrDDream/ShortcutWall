function ensureAuthenticated(req, res, next) {
  if (req.session?.isAuthenticated) {
    return next();
  }
  return res.redirect('/admin/login');
}

module.exports = { ensureAuthenticated };

const crypto = require('crypto');

const TOKEN_BYTES = 32;

// Ensures the session carries a CSRF token and exposes it to views, but only
// for sessions that actually render a form protected by it (the authenticated
// admin area, and the login page) — avoids creating a session for every
// anonymous visit to the public shortcut wall.
function attachCsrfToken(req, res, next) {
  if (!req.session) {
    return next();
  }

  if (req.session.isAuthenticated || req.path === '/admin/login') {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
  }

  next();
}

function verifyCsrfToken(req, res, next) {
  const sessionToken = req.session?.csrfToken;
  const submittedToken = typeof req.body?._csrf === 'string' ? req.body._csrf : '';

  const isValid =
    typeof sessionToken === 'string' &&
    sessionToken.length > 0 &&
    submittedToken.length === sessionToken.length &&
    crypto.timingSafeEqual(Buffer.from(submittedToken), Buffer.from(sessionToken));

  if (!isValid) {
    return res.status(403).send(res.locals.t('errors.invalidCsrfToken'));
  }

  next();
}

module.exports = { attachCsrfToken, verifyCsrfToken };

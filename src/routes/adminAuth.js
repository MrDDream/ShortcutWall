const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');

const { ADMIN_USER, ADMIN_PASS } = require('../config');
const { ensureAuthenticated } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const logger = require('../lib/logger');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).send(res.locals.t('errors.tooManyAttempts'));
  },
});

// Constant-time comparison that also tolerates length mismatches without
// throwing, to avoid both a timing side-channel and a crash on malformed input.
function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function isValidCredentials(username, password) {
  const validUsername = timingSafeStringEqual(username, ADMIN_USER);
  const validPassword = timingSafeStringEqual(password, ADMIN_PASS);
  return validUsername && validPassword;
}

router.get('/login', (req, res) => {
  if (req.session?.isAuthenticated) {
    return res.redirect('/admin');
  }
  res.render('login', { pageTitle: res.locals.t('app.loginTitle'), errorKey: null });
});

router.post('/login', loginLimiter, verifyCsrfToken, (req, res) => {
  const { username, password } = req.body;

  if (isValidCredentials(username, password)) {
    // Regenerated on every successful login to prevent session fixation.
    return req.session.regenerate((error) => {
      if (error) {
        logger.error({ err: error }, 'Unable to regenerate session');
        return res.status(500).send(res.locals.t('errors.sessionError'));
      }
      req.session.isAuthenticated = true;
      return res.redirect('/admin');
    });
  }

  res.render('login', {
    pageTitle: res.locals.t('app.loginTitle'),
    errorKey: 'login.invalidCredentials',
  });
});

router.post('/logout', ensureAuthenticated, verifyCsrfToken, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

module.exports = router;

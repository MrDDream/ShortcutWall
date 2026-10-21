const express = require('express');

const { normalizeLocale } = require('../lib/i18n');
const { LANGUAGE_COOKIE } = require('../config');

const LANGUAGE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', {
    sites: res.locals.sites,
    pageTitle: res.locals.t('app.homeTitle'),
  });
});

// Only redirects back to a same-origin path: trusting a client-controlled
// Referer header for the redirect target would otherwise allow an open redirect.
function resolveSameOriginRedirect(req) {
  const referer = req.get('Referer');
  if (!referer) {
    return '/';
  }

  try {
    const refererUrl = new URL(referer);
    const currentOrigin = `${req.protocol}://${req.get('host')}`;
    if (refererUrl.origin !== currentOrigin) {
      return '/';
    }
    return `${refererUrl.pathname}${refererUrl.search}`;
  } catch {
    return '/';
  }
}

router.get('/language/:locale', (req, res) => {
  const locale = normalizeLocale(req.params.locale);
  if (!locale) {
    return res.status(400).send(res.locals.t('errors.languageNotSupported'));
  }
  res.cookie(LANGUAGE_COOKIE, locale, {
    maxAge: LANGUAGE_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
  });
  return res.redirect(resolveSameOriginRedirect(req));
});

module.exports = router;

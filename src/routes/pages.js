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

// Only redirects back to a path of this same site: trusting a client-controlled
// Referer header for the redirect target would otherwise allow an open redirect.
// The host alone is compared, not the scheme: behind an HTTPS reverse proxy
// without TRUST_PROXY the app sees plain http while the browser's Referer says
// https, which used to send every language switch back to the home page.
function resolveSameOriginRedirect(req) {
  const referer = req.get('Referer');
  if (!referer) {
    return '/';
  }

  try {
    const refererUrl = new URL(referer);
    if (refererUrl.host !== req.get('host')) {
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

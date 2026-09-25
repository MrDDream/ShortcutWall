const express = require('express');

const { normalizeLocale } = require('../lib/i18n');

const router = express.Router();

router.get('/', (req, res) => {
  const viewMode = req.query.type === 'folders' ? 'folders' : 'sites';
  res.locals.includeViewSwitch = true;
  res.locals.viewMode = viewMode;
  res.render('index', {
    sites: res.locals.sites,
    folders: res.locals.folders,
    viewMode,
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
  } catch (error) {
    return '/';
  }
}

router.get('/language/:locale', (req, res) => {
  const locale = normalizeLocale(req.params.locale);
  if (!locale) {
    return res.status(400).send(res.locals.t('errors.languageNotSupported'));
  }
  if (req.session) {
    req.session.locale = locale;
  }
  return res.redirect(resolveSameOriginRedirect(req));
});

module.exports = router;

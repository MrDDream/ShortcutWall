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

router.get('/language/:locale', (req, res) => {
  const locale = normalizeLocale(req.params.locale);
  if (!locale) {
    return res.status(400).send(res.locals.t('errors.languageNotSupported'));
  }
  if (req.session) {
    req.session.locale = locale;
  }
  const redirectTarget = req.get('Referer') || '/';
  return res.redirect(redirectTarget);
});

module.exports = router;

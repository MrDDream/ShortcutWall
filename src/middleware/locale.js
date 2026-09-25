const { normalizeLocale, translate, DEFAULT_LOCALE } = require('../lib/i18n');
const { APP_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, LANGUAGE_FLAGS } = require('../config');

function localeMiddleware(req, res, next) {
  const sessionLocale = normalizeLocale(req.session?.locale) || DEFAULT_LOCALE;
  if (req.session) {
    req.session.locale = sessionLocale;
  }

  res.locals.locale = sessionLocale;
  res.locals.appName = APP_NAME;
  res.locals.t = (key, vars) => translate(sessionLocale, key, vars);
  res.locals.supportEmail = SUPPORT_EMAIL;
  res.locals.supportPhone = SUPPORT_PHONE;

  const nextLocale = sessionLocale === 'fr' ? 'en' : 'fr';
  const nextLanguageName = translate(sessionLocale, `language.name.${nextLocale}`);
  const currentLanguageName = translate(sessionLocale, `language.name.${sessionLocale}`);
  const currentFlag = LANGUAGE_FLAGS[sessionLocale] || {};

  res.locals.languageToggle = {
    next: nextLocale,
    currentIcon: currentFlag.icon || null,
    currentLabel: currentLanguageName,
    title: translate(sessionLocale, 'language.switch', { language: nextLanguageName }),
  };

  res.locals.clientTranslations = {
    invalidUrl: translate(sessionLocale, 'alerts.invalidUrl'),
    faviconLoading: translate(sessionLocale, 'alerts.faviconLoading'),
    faviconNotFound: translate(sessionLocale, 'alerts.faviconNotFound'),
    faviconError: translate(sessionLocale, 'alerts.faviconError'),
    confirmDelete: translate(sessionLocale, 'forms.confirmDelete'),
    searchNoResults: translate(sessionLocale, 'search.noResults'),
    saving: translate(sessionLocale, 'forms.saving'),
  };

  next();
}

module.exports = localeMiddleware;

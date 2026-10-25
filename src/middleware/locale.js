const { readCookie } = require('../lib/cookies');
const { normalizeLocale, translate, DEFAULT_LOCALE, SUPPORTED_LOCALES } = require('../lib/i18n');
const { APP_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, LANGUAGE_FLAGS, PROJECT_URL, LANGUAGE_COOKIE } = require('../config');

// The language comes from the "lang" cookie (set by /language/:locale), then
// from a session written by older versions, then the configured default. It is
// never written to the session: doing so used to create a session file for
// every anonymous visitor of the wall.
function localeMiddleware(req, res, next) {
  const sessionLocale =
    normalizeLocale(readCookie(req, LANGUAGE_COOKIE)) || normalizeLocale(req.session?.locale) || DEFAULT_LOCALE;

  res.locals.locale = sessionLocale;
  res.locals.appName = APP_NAME;
  res.locals.t = (key, vars) => translate(sessionLocale, key, vars);
  res.locals.supportEmail = SUPPORT_EMAIL;
  res.locals.supportPhone = SUPPORT_PHONE;

  // Header language picker. Each language is listed under its own name
  // ("Français", "English"), so readers recognise theirs whatever the
  // current page language is.
  res.locals.languages = SUPPORTED_LOCALES.map((code) => ({
    code,
    label: translate(code, `language.name.${code}`),
    icon: LANGUAGE_FLAGS[code]?.icon || null,
    active: code === sessionLocale,
  }));
  res.locals.projectUrl = PROJECT_URL;

  res.locals.clientTranslations = {
    invalidUrl: translate(sessionLocale, 'alerts.invalidUrl'),
    faviconLoading: translate(sessionLocale, 'alerts.faviconLoading'),
    faviconNotFound: translate(sessionLocale, 'alerts.faviconNotFound'),
    faviconError: translate(sessionLocale, 'alerts.faviconError'),
    confirmDelete: translate(sessionLocale, 'forms.confirmDelete'),
    confirmDeleteAction: translate(sessionLocale, 'forms.delete'),
    cancel: translate(sessionLocale, 'forms.cancel'),
    discardChanges: translate(sessionLocale, 'forms.discardChanges'),
    discardAction: translate(sessionLocale, 'forms.discard'),
    keepEditing: translate(sessionLocale, 'forms.keepEditing'),
    logoPreviewUnavailable: translate(sessionLocale, 'forms.logoPreviewUnavailable'),
    unexpectedError: translate(sessionLocale, 'errors.unexpected'),
    sessionExpired: translate(sessionLocale, 'errors.sessionExpired'),
    searchNoResults: translate(sessionLocale, 'search.noResults'),
    saving: translate(sessionLocale, 'forms.saving'),
  };

  next();
}

module.exports = localeMiddleware;

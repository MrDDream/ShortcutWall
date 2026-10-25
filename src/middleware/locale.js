const { readCookie } = require('../lib/cookies');
const { normalizeLocale, translate, DEFAULT_LOCALE, SUPPORTED_LOCALES } = require('../lib/i18n');
const { APP_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, LANGUAGE_FLAGS, PROJECT_URL, LANGUAGE_COOKIE } = require('../config');

// Messages the browser scripts need, by their name in public/js/i18n.js.
const CLIENT_TRANSLATION_KEYS = {
  invalidUrl: 'alerts.invalidUrl',
  faviconLoading: 'alerts.faviconLoading',
  faviconNotFound: 'alerts.faviconNotFound',
  faviconError: 'alerts.faviconError',
  confirmDelete: 'forms.confirmDelete',
  confirmDeleteAction: 'forms.delete',
  cancel: 'forms.cancel',
  discardChanges: 'forms.discardChanges',
  discardAction: 'forms.discard',
  keepEditing: 'forms.keepEditing',
  logoPreviewUnavailable: 'forms.logoPreviewUnavailable',
  unexpectedError: 'errors.unexpected',
  sessionExpired: 'errors.sessionExpired',
  searchNoResults: 'search.noResults',
  saving: 'forms.saving',
};

// Everything the views need for one language, built once at startup rather
// than on every request. Each language is listed under its own name
// ("Français", "English") in the header picker, so readers recognise theirs
// whatever the current page language is.
const LOCALE_CONTEXTS = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [
    locale,
    {
      locale,
      t: (key, vars) => translate(locale, key, vars),
      languages: SUPPORTED_LOCALES.map((code) => ({
        code,
        label: translate(code, `language.name.${code}`),
        icon: LANGUAGE_FLAGS[code]?.icon || null,
        active: code === locale,
      })),
      clientTranslations: Object.fromEntries(
        Object.entries(CLIENT_TRANSLATION_KEYS).map(([name, key]) => [name, translate(locale, key)]),
      ),
    },
  ]),
);

// The language comes from the "lang" cookie (set by /language/:locale), then
// from a session written by older versions, then the configured default. It is
// never written to the session: doing so used to create a session file for
// every anonymous visitor of the wall.
function localeMiddleware(req, res, next) {
  const locale =
    normalizeLocale(readCookie(req, LANGUAGE_COOKIE)) || normalizeLocale(req.session?.locale) || DEFAULT_LOCALE;

  Object.assign(res.locals, LOCALE_CONTEXTS[locale], {
    appName: APP_NAME,
    supportEmail: SUPPORT_EMAIL,
    supportPhone: SUPPORT_PHONE,
    projectUrl: PROJECT_URL,
  });
  next();
}

module.exports = localeMiddleware;

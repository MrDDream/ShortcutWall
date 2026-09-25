const fr = require('../locales/fr.json');
const en = require('../locales/en.json');
const { SUPPORTED_LOCALES, DEFAULT_LOCALE_RAW } = require('../config');

const TRANSLATIONS = { fr, en };

function normalizeLocale(value) {
  if (!value) {
    return null;
  }
  const lowered = value.toString().trim().toLowerCase();
  return SUPPORTED_LOCALES.includes(lowered) ? lowered : null;
}

const DEFAULT_LOCALE = normalizeLocale(DEFAULT_LOCALE_RAW) || 'fr';

function translate(locale, key, vars = {}) {
  const dictionary = TRANSLATIONS[locale] || TRANSLATIONS[DEFAULT_LOCALE];
  const parts = key.split('.');
  let current = dictionary;
  for (const part of parts) {
    if (current && Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
    } else {
      current = null;
      break;
    }
  }
  if (typeof current !== 'string') {
    return key;
  }
  return current.replace(/\{(\w+)\}/g, (_, token) => (token in vars ? vars[token] : `{${token}}`));
}

module.exports = { normalizeLocale, translate, DEFAULT_LOCALE, SUPPORTED_LOCALES };

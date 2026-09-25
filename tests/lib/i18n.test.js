import { describe, it, expect } from 'vitest';

import { translate, normalizeLocale, DEFAULT_LOCALE } from '../../src/lib/i18n.js';

describe('i18n.translate', () => {
  it('translates a known key in each supported locale', () => {
    expect(translate('en', 'header.login')).toBe('Sign in');
    expect(translate('fr', 'header.login')).toBe('Connexion');
  });

  it('falls back to the default locale for an unsupported locale', () => {
    expect(translate('xx', 'header.login')).toBe(translate(DEFAULT_LOCALE, 'header.login'));
  });

  it('returns the key itself for an unknown key', () => {
    expect(translate('en', 'this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('interpolates variables', () => {
    expect(translate('en', 'language.switch', { language: 'French' })).toBe('Switch to French');
  });

  it('leaves an unresolved placeholder untouched', () => {
    expect(translate('en', 'language.switch', {})).toBe('Switch to {language}');
  });
});

describe('i18n.normalizeLocale', () => {
  it('accepts supported locales case-insensitively', () => {
    expect(normalizeLocale('fr')).toBe('fr');
    expect(normalizeLocale('EN')).toBe('en');
    expect(normalizeLocale('  en  ')).toBe('en');
  });

  it('rejects unsupported or empty values', () => {
    expect(normalizeLocale('de')).toBeNull();
    expect(normalizeLocale('')).toBeNull();
    expect(normalizeLocale(undefined)).toBeNull();
  });
});

require('dotenv').config();

const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

const PORT = Number(process.env.PORT) || 3050;
const HOST = process.env.HOST || '0.0.0.0';
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

const VIEWS_DIR = path.join(ROOT_DIR, 'views');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const SITES_FILE = path.join(ROOT_DIR, 'data', 'shortcuts.json');
const FOLDERS_FILE = path.join(ROOT_DIR, 'data', 'folders.json');

const DEFAULT_ADMIN_USER = 'admin';
const DEFAULT_ADMIN_PASS = 'admin123';
const DEFAULT_SESSION_SECRET = 'change-me';

const ADMIN_USER = process.env.ADMIN_USER || DEFAULT_ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS || DEFAULT_ADMIN_PASS;
const SESSION_SECRET = process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;

const APP_NAME = (process.env.APP_NAME && process.env.APP_NAME.trim()) || 'ShortcutWall';
const SUPPORT_EMAIL = (process.env.SUPPORT_EMAIL && process.env.SUPPORT_EMAIL.trim()) || '';
const SUPPORT_PHONE = (process.env.SUPPORT_PHONE && process.env.SUPPORT_PHONE.trim()) || '';

const FAVICON_FETCH_TIMEOUT = 5000;

const SUPPORTED_LOCALES = ['fr', 'en'];
const DEFAULT_LOCALE_RAW = process.env.APP_DEFAULT_LOCALE;

const LANGUAGE_FLAGS = {
  fr: { icon: '/images/flags/fr.svg' },
  en: { icon: '/images/flags/gb.svg' },
};

// Loud, unmissable warnings if the operator never overrode the well-known
// defaults published in this repo's .env.example — anyone who read the source
// can log in, or (for SESSION_SECRET) forge a valid admin session cookie.
if (SESSION_SECRET === DEFAULT_SESSION_SECRET) {
  console.warn(
    '[SECURITY] SESSION_SECRET is left at its default value. Set a unique, random SESSION_SECRET in your environment.',
  );
}
if (ADMIN_USER === DEFAULT_ADMIN_USER && ADMIN_PASS === DEFAULT_ADMIN_PASS) {
  console.warn(
    '[SECURITY] ADMIN_USER/ADMIN_PASS are left at their default values. Set unique credentials in your environment.',
  );
}

module.exports = {
  ROOT_DIR,
  VIEWS_DIR,
  PUBLIC_DIR,
  UPLOAD_DIR,
  SITES_FILE,
  FOLDERS_FILE,
  NODE_ENV,
  IS_PRODUCTION,
  PORT,
  HOST,
  TRUST_PROXY,
  ADMIN_USER,
  ADMIN_PASS,
  SESSION_SECRET,
  APP_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  FAVICON_FETCH_TIMEOUT,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE_RAW,
  LANGUAGE_FLAGS,
};

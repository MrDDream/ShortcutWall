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
// Overridable like DATA_DIR, so tests and throwaway instances never read,
// write or clean up the real uploaded logos. Served at /uploads (see app.js).
const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(PUBLIC_DIR, 'uploads');
// Overridable so tests (and operators who want to relocate storage) can point
// at an isolated directory instead of the real data/ used in production.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT_DIR, 'data');
const SITES_FILE = path.join(DATA_DIR, 'shortcuts.json');

const DEFAULT_ADMIN_USER = 'admin';
const DEFAULT_ADMIN_PASS = 'admin123';
const DEFAULT_SESSION_SECRET = 'change-me';

const ADMIN_USER = process.env.ADMIN_USER || DEFAULT_ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS || DEFAULT_ADMIN_PASS;
const SESSION_SECRET = process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;

const APP_NAME = (process.env.APP_NAME && process.env.APP_NAME.trim()) || 'ShortcutWall';
const SUPPORT_EMAIL = (process.env.SUPPORT_EMAIL && process.env.SUPPORT_EMAIL.trim()) || '';
const SUPPORT_PHONE = (process.env.SUPPORT_PHONE && process.env.SUPPORT_PHONE.trim()) || '';

// Lets the server reach sites on private networks (192.168.x.x, 10.x.x.x,
// VPNs…) to check them and fetch their logo. Loopback and cloud metadata
// addresses stay blocked either way; set to false on an instance exposed to
// people who shouldn't be able to probe its network.
const ALLOW_PRIVATE_NETWORKS = process.env.ALLOW_PRIVATE_NETWORKS !== 'false';

// Whole outgoing HTTP exchange (reachability checks, favicons, logo imports),
// response body included.
const HTTP_TIMEOUT_MS = 10000;

const SUPPORTED_LOCALES = ['fr', 'en'];
// Remembers the visitor's language choice without creating a server session.
const LANGUAGE_COOKIE = 'lang';

// Linked from the header's GitHub button.
const PROJECT_URL = 'https://github.com/MrDDream/ShortcutWall';
const DEFAULT_LOCALE_RAW = process.env.APP_DEFAULT_LOCALE;

const LANGUAGE_FLAGS = {
  fr: { icon: '/images/flags/fr.svg' },
  en: { icon: '/images/flags/gb.svg' },
};

// The password and the session secret published in this repository: anyone who
// read the source could log in, or sign a session cookie.
const USES_DEFAULT_CREDENTIALS = SESSION_SECRET === DEFAULT_SESSION_SECRET || ADMIN_PASS === DEFAULT_ADMIN_PASS;

// Signs session cookies and the login form's CSRF token: a short one could be
// brute-forced offline.
const MIN_SESSION_SECRET_LENGTH = 32;

// Refuse to serve a production instance with them (outside production, e.g. a
// quick local try, the admin area shows a warning banner instead).
if (IS_PRODUCTION && USES_DEFAULT_CREDENTIALS) {
  throw new Error(
    'Refusing to start in production with the default ADMIN_PASS or SESSION_SECRET. ' +
      'Set your own values in .env (see .env.example).',
  );
}
if (IS_PRODUCTION && SESSION_SECRET.length < MIN_SESSION_SECRET_LENGTH) {
  throw new Error(
    `Refusing to start in production with a SESSION_SECRET shorter than ${MIN_SESSION_SECRET_LENGTH} characters. ` +
      'Generate one with: openssl rand -hex 32',
  );
}

module.exports = {
  VIEWS_DIR,
  PUBLIC_DIR,
  UPLOAD_DIR,
  DATA_DIR,
  SITES_FILE,
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
  ALLOW_PRIVATE_NETWORKS,
  HTTP_TIMEOUT_MS,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE_RAW,
  LANGUAGE_FLAGS,
  PROJECT_URL,
  LANGUAGE_COOKIE,
  USES_DEFAULT_CREDENTIALS,
};

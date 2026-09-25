require('dotenv').config();

const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

const PORT = Number(process.env.PORT) || 3050;
const HOST = process.env.HOST || '0.0.0.0';

const VIEWS_DIR = path.join(ROOT_DIR, 'views');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const SITES_FILE = path.join(ROOT_DIR, 'data', 'shortcuts.json');
const FOLDERS_FILE = path.join(ROOT_DIR, 'data', 'folders.json');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';

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

module.exports = {
  ROOT_DIR,
  VIEWS_DIR,
  PUBLIC_DIR,
  UPLOAD_DIR,
  SITES_FILE,
  FOLDERS_FILE,
  PORT,
  HOST,
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

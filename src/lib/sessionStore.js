const fs = require('fs');
const path = require('path');
const session = require('express-session');
const FileStoreFactory = require('session-file-store');

const { DATA_DIR, SESSION_SECRET } = require('../config');
const logger = require('./logger');

const FileStore = FileStoreFactory(session);

const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');

fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// Persists sessions to disk instead of express-session's default MemoryStore,
// which the package itself warns is unfit for production (unbounded memory
// growth, and every restart silently logs every admin out).
const sessionStore = new FileStore({
  path: SESSIONS_DIR,
  ttl: 2 * 60 * 60, // seconds, kept in sync with the cookie maxAge in src/app.js
  retries: 1,
  secret: SESSION_SECRET, // encrypts session files at rest
  logFn: (message) => logger.debug(message),
});

module.exports = sessionStore;

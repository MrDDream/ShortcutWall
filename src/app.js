const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const pinoHttp = require('pino-http');

const { SESSION_SECRET, VIEWS_DIR, PUBLIC_DIR, TRUST_PROXY } = require('./config');
const logger = require('./lib/logger');
const sessionStore = require('./lib/sessionStore');
const localeMiddleware = require('./middleware/locale');
const { loadShortcuts } = require('./middleware/shortcuts');
const { attachCsrfToken } = require('./middleware/csrf');
const { InvalidFileError } = require('./lib/uploads');

const pagesRouter = require('./routes/pages');
const downloadsRouter = require('./routes/downloads');
const adminAuthRouter = require('./routes/adminAuth');
const adminDashboardRouter = require('./routes/adminDashboard');
const sitesRouter = require('./routes/sites');
const foldersRouter = require('./routes/folders');
const faviconRouter = require('./routes/favicon');
const healthRouter = require('./routes/health');

// Builds a fresh, fully wired Express app instance. Kept separate from the
// process entry point (server.js) so tests can exercise it with Supertest
// without binding a real port.
function createApp() {
  const app = express();

  if (TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  app.set('view engine', 'ejs');
  app.set('views', VIEWS_DIR);

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/healthz' },
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          // Shortcut logos are fetched from arbitrary admin-supplied hosts by design.
          imgSrc: ["'self'", 'data:', 'http:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
        },
      },
    }),
  );

  // Lightweight and unauthenticated on purpose: container orchestrators poll
  // this frequently and it must stay cheap (no session/locale/data-loading).
  app.use('/healthz', healthRouter);

  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(PUBLIC_DIR));
  app.use(
    session({
      store: sessionStore,
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 2 * 60 * 60 * 1000, // 2 hours
        httpOnly: true,
        sameSite: 'lax',
        // 'auto' sets Secure when the request is HTTPS (directly, or via a proxy
        // when TRUST_PROXY=true) without breaking plain-HTTP self-hosted setups.
        secure: 'auto',
      },
    }),
  );

  app.use(attachCsrfToken);
  app.use(localeMiddleware);
  app.use(loadShortcuts);

  app.use('/', pagesRouter);
  app.use('/', downloadsRouter);
  app.use('/admin', adminAuthRouter);
  app.use('/admin', adminDashboardRouter);
  app.use('/admin/site', sitesRouter);
  app.use('/admin/folder', foldersRouter);
  app.use('/api/favicon', faviconRouter);

  app.use((req, res) => {
    res.status(404).render('404', { pageTitle: res.locals.t('app.notFoundTitle') });
  });

  // Centralized error handler: logs the real error server-side, never leaks
  // internals (stack traces, file paths) to the client.
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    (req.log || logger).error({ err }, 'Unhandled error');

    if (err instanceof InvalidFileError) {
      return res.status(400).send(res.locals.t('errors.unsupportedFileType'));
    }

    const isClientError = err?.name === 'MulterError';
    const status = isClientError ? 400 : err?.status || 500;
    const message = res.locals.t ? res.locals.t('errors.unexpected') : 'Unexpected error.';

    res.status(status).send(message);
  });

  return app;
}

module.exports = createApp;

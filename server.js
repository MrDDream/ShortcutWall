const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const { PORT, HOST, SESSION_SECRET, VIEWS_DIR, PUBLIC_DIR, TRUST_PROXY, IS_PRODUCTION } = require('./src/config');
const localeMiddleware = require('./src/middleware/locale');
const { loadShortcuts } = require('./src/middleware/shortcuts');
const { attachCsrfToken } = require('./src/middleware/csrf');
const { InvalidFileError } = require('./src/lib/uploads');

const pagesRouter = require('./src/routes/pages');
const downloadsRouter = require('./src/routes/downloads');
const adminAuthRouter = require('./src/routes/adminAuth');
const adminDashboardRouter = require('./src/routes/adminDashboard');
const sitesRouter = require('./src/routes/sites');
const foldersRouter = require('./src/routes/folders');
const faviconRouter = require('./src/routes/favicon');

const app = express();

if (TRUST_PROXY) {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', VIEWS_DIR);

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

app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));
app.use(
  session({
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

  console.error('Unhandled error', err);

  if (err instanceof InvalidFileError) {
    return res.status(400).send(res.locals.t('errors.unsupportedFileType'));
  }

  const isClientError = err?.name === 'MulterError';
  const status = isClientError ? 400 : err?.status || 500;
  const message = res.locals.t ? res.locals.t('errors.unexpected') : 'Unexpected error.';

  res.status(status).send(message);
});

app.listen(PORT, HOST, () => {
  const hostText = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  console.log(`Serveur pret sur http://${hostText}:${PORT}`);
  if (!IS_PRODUCTION) {
    console.log(`NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  }
});

const express = require('express');
const session = require('express-session');

const { PORT, HOST, SESSION_SECRET, VIEWS_DIR, PUBLIC_DIR } = require('./src/config');
const localeMiddleware = require('./src/middleware/locale');
const { loadShortcuts } = require('./src/middleware/shortcuts');

const pagesRouter = require('./src/routes/pages');
const downloadsRouter = require('./src/routes/downloads');
const adminAuthRouter = require('./src/routes/adminAuth');
const adminDashboardRouter = require('./src/routes/adminDashboard');
const sitesRouter = require('./src/routes/sites');
const foldersRouter = require('./src/routes/folders');
const faviconRouter = require('./src/routes/favicon');

const app = express();

app.set('view engine', 'ejs');
app.set('views', VIEWS_DIR);

app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    },
  }),
);

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

app.listen(PORT, HOST, () => {
  const hostText = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  console.log(`Serveur pret sur http://${hostText}:${PORT}`);
});

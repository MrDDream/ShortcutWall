const express = require('express');

const { ADMIN_USER, ADMIN_PASS } = require('../config');
const { ensureAuthenticated } = require('../middleware/auth');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session?.isAuthenticated) {
    return res.redirect('/admin');
  }
  res.render('login', { pageTitle: res.locals.t('app.loginTitle'), errorKey: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAuthenticated = true;
    return res.redirect('/admin');
  }

  res.render('login', {
    pageTitle: res.locals.t('app.loginTitle'),
    errorKey: 'login.invalidCredentials',
  });
});

router.post('/logout', ensureAuthenticated, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

module.exports = router;

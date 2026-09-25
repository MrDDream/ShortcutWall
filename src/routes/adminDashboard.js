const express = require('express');

const { ensureAuthenticated } = require('../middleware/auth');

const router = express.Router();

const STATUS_KEYS = {
  created: 'admin.statusCreated',
  updated: 'admin.statusUpdated',
  deleted: 'admin.statusDeleted',
};

router.get('/', ensureAuthenticated, (req, res) => {
  const activeTab = req.query.tab === 'folders' ? 'folders' : 'sites';
  const statusKey = STATUS_KEYS[req.query.status] || null;

  res.render('admin', {
    sites: res.locals.sites,
    folders: res.locals.folders,
    activeTab,
    statusKey,
    pageTitle: res.locals.t('app.adminTitle'),
  });
});

module.exports = router;

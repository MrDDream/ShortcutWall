const express = require('express');

const { ensureAuthenticated } = require('../middleware/auth');
const { USES_DEFAULT_CREDENTIALS } = require('../config');

const router = express.Router();

const STATUS_KEYS = {
  created: 'admin.statusCreated',
  updated: 'admin.statusUpdated',
  deleted: 'admin.statusDeleted',
  restored: 'admin.statusRestored',
};

router.get('/', ensureAuthenticated, (req, res) => {
  const activeTab = req.query.tab === 'folders' ? 'folders' : 'sites';
  const statusKey = STATUS_KEYS[req.query.status] || null;
  // Only meaningful alongside a "deleted" status: any other value is ignored downstream.
  const undoToken =
    req.query.status === 'deleted' && typeof req.query.undoToken === 'string' ? req.query.undoToken : null;

  res.render('admin', {
    sites: res.locals.sites,
    folders: res.locals.folders,
    activeTab,
    statusKey,
    undoToken,
    usesDefaultCredentials: USES_DEFAULT_CREDENTIALS,
    pageTitle: res.locals.t('app.adminTitle'),
  });
});

module.exports = router;

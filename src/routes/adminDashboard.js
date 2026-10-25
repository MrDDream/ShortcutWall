const express = require('express');

const { ensureAuthenticated } = require('../middleware/auth');
const { loadShortcuts } = require('../middleware/shortcuts');
const { USES_DEFAULT_CREDENTIALS } = require('../config');
const { FIELD_LIMITS } = require('../lib/siteFields');
const { TTL_MS: UNDO_WINDOW_MS } = require('../lib/trash');

// Statuses whose toast can offer "Undo" (see routes/trash.js).
const UNDOABLE_STATUSES = new Set(['deleted', 'imported']);

const router = express.Router();

const STATUS_KEYS = {
  created: 'admin.statusCreated',
  updated: 'admin.statusUpdated',
  deleted: 'admin.statusDeleted',
  restored: 'admin.statusRestored',
  imported: 'admin.statusImported',
};

router.get('/', ensureAuthenticated, loadShortcuts, (req, res) => {
  const statusKey = STATUS_KEYS[req.query.status] || null;
  const undoToken =
    UNDOABLE_STATUSES.has(req.query.status) && typeof req.query.undoToken === 'string' ? req.query.undoToken : null;

  res.render('admin', {
    sites: res.locals.sites,
    statusKey,
    statusVars: { count: Number.parseInt(req.query.count, 10) || 0 },
    undoToken,
    undoWindowMs: UNDO_WINDOW_MS,
    usesDefaultCredentials: USES_DEFAULT_CREDENTIALS,
    fieldLimits: FIELD_LIMITS,
    pageTitle: res.locals.t('app.adminTitle'),
  });
});

module.exports = router;

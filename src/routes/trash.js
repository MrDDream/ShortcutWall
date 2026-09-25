const express = require('express');

const { SITES_FILE, FOLDERS_FILE } = require('../config');
const { ensureAuthenticated } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const { updateJson } = require('../lib/store');
const { pop } = require('../lib/trash');

const router = express.Router();

const FILE_BY_TYPE = { site: SITES_FILE, folder: FOLDERS_FILE };
const TAB_BY_TYPE = { site: 'sites', folder: 'folders' };

router.post('/:token/restore', ensureAuthenticated, verifyCsrfToken, async (req, res, next) => {
  try {
    const payload = pop(req.params.token);

    if (!payload || !FILE_BY_TYPE[payload.type]) {
      // Expired, already used, or unknown: nothing to restore, just go back.
      return res.redirect('/admin');
    }

    await updateJson(FILE_BY_TYPE[payload.type], (items) => {
      items.push(payload.item);
      return items;
    });

    res.redirect(`/admin?tab=${TAB_BY_TYPE[payload.type]}&status=restored`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

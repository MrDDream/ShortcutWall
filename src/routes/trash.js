const express = require('express');

const { SITES_FILE } = require('../config');
const { ensureAuthenticated } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const { updateJson } = require('../lib/store');
const { deleteAssetIfUnused } = require('../lib/uploadsCleanup');
const { pop } = require('../lib/trash');

const router = express.Router();

// Undoes, within the trash window, either a single site deletion
// ({ type: 'site', item }) or an import in "replace" mode ({ type: 'sites',
// items }: the list as it was before the import).
router.post('/:token/restore', ensureAuthenticated, verifyCsrfToken, async (req, res, next) => {
  try {
    const payload = pop(req.params.token);

    if (payload?.type === 'site') {
      await updateJson(SITES_FILE, (sites) => [...sites, payload.item]);
    } else if (payload?.type === 'sites') {
      // Sites added since the import are dropped along with the imported ones.
      let replaced = [];
      await updateJson(SITES_FILE, (sites) => {
        replaced = sites;
        return payload.items;
      });
      // Their logos go too, unless the restored list still uses them.
      for (const site of replaced) {
        await deleteAssetIfUnused(site.imageUrl);
      }
    } else {
      // Expired, already used, or unknown: nothing to restore, just go back.
      return res.redirect('/admin');
    }

    res.redirect('/admin?status=restored');
  } catch (error) {
    next(error);
  }
});

module.exports = router;

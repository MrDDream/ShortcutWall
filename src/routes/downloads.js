const express = require('express');

const { ensureSiteExists, ensureFolderExists } = require('../middleware/shortcuts');
const { buildDownloadFilename } = require('../lib/filenames');
const { normalizeNetworkPath } = require('../lib/urlUtils');
const { createInternetShortcutPayload, sendInternetShortcut } = require('../lib/shortcutDownload');

const router = express.Router();

router.get('/site/:id/download', ensureSiteExists, (req, res) => {
  const site = res.locals.site;
  const filename = `${buildDownloadFilename(site.name, 'site')}.url`;
  const payload = createInternetShortcutPayload(site.targetUrl);

  sendInternetShortcut(res, filename, payload);
});

router.get('/folder/:id/download', ensureFolderExists, (req, res) => {
  const folder = res.locals.folder;
  const filename = `${buildDownloadFilename(folder.name, 'dossier')}.url`;
  const payload = createInternetShortcutPayload(normalizeNetworkPath(folder.networkPath));

  sendInternetShortcut(res, filename, payload);
});

module.exports = router;

const { SITES_FILE, FOLDERS_FILE } = require('../config');
const { readJson } = require('../lib/store');

async function loadShortcuts(req, res, next) {
  try {
    const [sites, folders] = await Promise.all([readJson(SITES_FILE), readJson(FOLDERS_FILE)]);
    res.locals.sites = Array.isArray(sites)
      ? [...sites].sort((a, b) => {
          const nameA = (a?.name || '').toString();
          const nameB = (b?.name || '').toString();
          return nameA.localeCompare(nameB, res.locals.locale, { sensitivity: 'base' });
        })
      : [];
    res.locals.folders = folders;
  } catch (error) {
    console.error('Unable to load data files', error);
    res.locals.sites = [];
    res.locals.folders = [];
  }
  res.locals.includeViewSwitch = false;
  res.locals.viewMode = 'sites';
  res.locals.isAuthenticated = req.session?.isAuthenticated;
  next();
}

function ensureSiteExists(req, res, next) {
  const site = res.locals.sites.find((item) => item.id === req.params.id);
  if (!site) {
    return res.status(404).send(res.locals.t('errors.siteNotFound'));
  }
  res.locals.site = site;
  next();
}

function ensureFolderExists(req, res, next) {
  const folder = res.locals.folders.find((item) => item.id === req.params.id);
  if (!folder) {
    return res.status(404).send(res.locals.t('errors.folderNotFound'));
  }
  res.locals.folder = folder;
  next();
}

module.exports = { loadShortcuts, ensureSiteExists, ensureFolderExists };

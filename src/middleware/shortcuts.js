const { SITES_FILE } = require('../config');
const { readJson } = require('../lib/store');
const logger = require('../lib/logger');

async function loadShortcuts(req, res, next) {
  try {
    const sites = await readJson(SITES_FILE);
    res.locals.sites = Array.isArray(sites)
      ? [...sites].sort((a, b) => {
          const nameA = (a?.name || '').toString();
          const nameB = (b?.name || '').toString();
          return nameA.localeCompare(nameB, res.locals.locale, { sensitivity: 'base' });
        })
      : [];
  } catch (error) {
    logger.error({ err: error }, 'Unable to load data files');
    res.locals.sites = [];
  }
  res.locals.isAuthenticated = req.session?.isAuthenticated;
  next();
}

module.exports = { loadShortcuts };

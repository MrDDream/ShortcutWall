const express = require('express');

const { ensureAuthenticated } = require('../middleware/auth');
const { normalizeTargetUrl, isUrlReachable } = require('../lib/urlUtils');
const { findFavicon } = require('../lib/favicon');

const router = express.Router();

// API endpoint for retrieving the favicon for a given URL.
router.get('/', ensureAuthenticated, async (req, res) => {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';

  try {
    const targetUrl = normalizeTargetUrl(rawUrl);

    const reachable = await isUrlReachable(targetUrl);

    if (!reachable) {
      return res.status(400).json({
        success: false,
        message: res.locals.t('errors.siteUnreachable'),
      });
    }

    const faviconUrl = await findFavicon(targetUrl);

    if (!faviconUrl) {
      return res.status(404).json({
        success: false,
        message: res.locals.t('errors.faviconNotFound'),
      });
    }

    return res.json({
      success: true,
      faviconUrl,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du favicon', error);

    return res.status(400).json({
      success: false,
      message: res.locals.t('errors.faviconFetchFailed'),
    });
  }
});

module.exports = router;

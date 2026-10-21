const express = require('express');

const { ensureAuthenticated } = require('../middleware/auth');
const { normalizeTargetUrl, isUrlReachable } = require('../lib/urlUtils');
const { findFavicon } = require('../lib/favicon');
const { importRemoteImage } = require('../lib/remoteImage');
const logger = require('../lib/logger');

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

    // Served from the app when possible (see importRemoteImage), so the
    // preview and the wall work even if the site forbids embedding its images.
    const localUrl = await importRemoteImage(faviconUrl);

    return res.json({
      success: true,
      faviconUrl: localUrl || faviconUrl,
    });
  } catch (error) {
    logger.error({ err: error }, 'Favicon fetch failed');

    return res.status(400).json({
      success: false,
      message: res.locals.t('errors.faviconFetchFailed'),
    });
  }
});

module.exports = router;

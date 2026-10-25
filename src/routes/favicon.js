const express = require('express');

const { ensureAuthenticated } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const { normalizeTargetUrl, isUrlReachable } = require('../lib/urlUtils');
const { findFavicon } = require('../lib/favicon');
const { importRemoteImage } = require('../lib/remoteImage');
const logger = require('../lib/logger');

const router = express.Router();

// The whole lookup (reachability, page, up to a dozen icon checks, download)
// is cut off after this, so a slow site can't keep the dialog waiting for a
// minute or more.
const FAVICON_LOOKUP_TIMEOUT_MS = 25000;

// Finds a site's favicon and stores a local copy. A POST protected by the
// CSRF token, since it writes a file: a cross-site link must not trigger it.
router.post('/', ensureAuthenticated, verifyCsrfToken, async (req, res) => {
  const rawUrl = typeof req.body.url === 'string' ? req.body.url.trim() : '';

  try {
    const targetUrl = normalizeTargetUrl(rawUrl);
    const deadline = AbortSignal.timeout(FAVICON_LOOKUP_TIMEOUT_MS);
    const timedOut = () => res.status(504).json({ success: false, message: res.locals.t('errors.faviconFetchFailed') });

    const reachable = await isUrlReachable(targetUrl, { signal: deadline });
    if (deadline.aborted) {
      return timedOut();
    }

    if (!reachable) {
      return res.status(400).json({
        success: false,
        message: res.locals.t('errors.siteUnreachable'),
      });
    }

    const faviconUrl = await findFavicon(targetUrl, { signal: deadline });
    if (deadline.aborted) {
      return timedOut();
    }

    if (!faviconUrl) {
      return res.status(404).json({
        success: false,
        message: res.locals.t('errors.faviconNotFound'),
      });
    }

    // Served from the app when possible (see importRemoteImage), so the
    // preview and the wall work even if the site forbids embedding its images.
    const localUrl = await importRemoteImage(faviconUrl, { signal: deadline });

    return res.json({
      success: true,
      faviconUrl: localUrl || faviconUrl,
    });
  } catch (error) {
    logger.error({ err: error }, 'Favicon fetch failed');

    return res.status(500).json({
      success: false,
      message: res.locals.t('errors.faviconFetchFailed'),
    });
  }
});

module.exports = router;

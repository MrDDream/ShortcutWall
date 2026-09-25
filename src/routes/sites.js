const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { SITES_FILE } = require('../config');
const { ensureAuthenticated } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const { readJson, updateJson, NotFoundError } = require('../lib/store');
const { upload, buildUploadedPath, deleteUploadedAsset } = require('../lib/uploads');
const { normalizeTargetUrl, normalizeImageUrl, isUrlReachable } = require('../lib/urlUtils');
const { stash } = require('../lib/trash');
const logger = require('../lib/logger');

const router = express.Router();

router.post('/', ensureAuthenticated, upload.single('imageFile'), verifyCsrfToken, async (req, res) => {
  const uploadedPath = req.file ? buildUploadedPath(req.file.filename) : null;
  try {
    const { name, targetUrl } = req.body;

    const descriptionInput = typeof req.body.description === 'string' ? req.body.description.trim() : '';

    if (!name || !targetUrl) {
      if (uploadedPath) {
        await deleteUploadedAsset(uploadedPath);
      }

      return res.status(400).send(res.locals.t('errors.missingSiteFields'));
    }

    let normalizedUrl;
    let normalizedImageUrl;

    try {
      normalizedUrl = normalizeTargetUrl(targetUrl);
      normalizedImageUrl = uploadedPath || normalizeImageUrl(req.body.imageUrl);
    } catch {
      if (uploadedPath) {
        await deleteUploadedAsset(uploadedPath);
      }

      return res.status(400).send(res.locals.t('errors.invalidUrl'));
    }

    const reachable = await isUrlReachable(normalizedUrl);

    if (!reachable) {
      if (uploadedPath) {
        await deleteUploadedAsset(uploadedPath);
      }

      return res.status(400).send(res.locals.t('errors.siteUnreachable'));
    }

    await updateJson(SITES_FILE, (sites) => {
      sites.push({
        id: uuidv4(),
        name: name.trim(),
        targetUrl: normalizedUrl,
        description: descriptionInput,
        imageUrl: normalizedImageUrl,
        createdAt: new Date().toISOString(),
      });
      return sites;
    });

    res.redirect('/admin?tab=sites&status=created');
  } catch (error) {
    logger.error({ err: error }, 'Site creation failed');

    if (uploadedPath) {
      await deleteUploadedAsset(uploadedPath);
    }

    res.status(500).send(res.locals.t('errors.shortcutGeneration'));
  }
});

router.post('/:id', ensureAuthenticated, upload.single('imageFile'), verifyCsrfToken, async (req, res) => {
  const uploadedPath = req.file ? buildUploadedPath(req.file.filename) : null;
  try {
    const { id } = req.params;
    const { name, targetUrl } = req.body;
    const descriptionInput = typeof req.body.description === 'string' ? req.body.description.trim() : undefined;

    // Snapshot read to compute fallbacks (existing targetUrl/imageUrl) and to
    // validate/run the network reachability check *before* touching the file.
    // The actual persisted mutation below re-reads the current state under the
    // lock, so a concurrent delete/update is still handled correctly.
    const currentSites = await readJson(SITES_FILE);
    const currentSite = currentSites.find((site) => site.id === id);

    if (!currentSite) {
      if (uploadedPath) {
        await deleteUploadedAsset(uploadedPath);
      }
      return res.status(404).send(res.locals.t('errors.siteNotFound'));
    }

    let normalizedUrl;
    let nextImage = currentSite.imageUrl;
    let shouldDeletePrevious = false;

    try {
      normalizedUrl = normalizeTargetUrl(targetUrl?.trim() || currentSite.targetUrl);

      if (uploadedPath) {
        nextImage = uploadedPath;
        shouldDeletePrevious = true;
      } else if (typeof req.body.imageUrl !== 'undefined') {
        nextImage = normalizeImageUrl(req.body.imageUrl);
        if (nextImage !== currentSite.imageUrl) {
          shouldDeletePrevious = true;
        }
      }
    } catch {
      if (uploadedPath) {
        await deleteUploadedAsset(uploadedPath);
      }
      return res.status(400).send(res.locals.t('errors.invalidUrl'));
    }

    const reachable = await isUrlReachable(normalizedUrl);

    if (!reachable) {
      if (uploadedPath) {
        await deleteUploadedAsset(uploadedPath);
      }
      return res.status(400).send(res.locals.t('errors.siteUnreachable'));
    }

    const previousImage = currentSite.imageUrl;

    await updateJson(SITES_FILE, (sites) => {
      const index = sites.findIndex((site) => site.id === id);
      if (index === -1) {
        throw new NotFoundError();
      }

      sites[index] = {
        ...sites[index],
        name: name?.trim() || sites[index].name,
        targetUrl: normalizedUrl,
        description: typeof descriptionInput === 'undefined' ? sites[index].description || '' : descriptionInput,
        imageUrl: nextImage,
        updatedAt: new Date().toISOString(),
      };

      return sites;
    });

    if (shouldDeletePrevious) {
      await deleteUploadedAsset(previousImage);
    }

    res.redirect('/admin?tab=sites&status=updated');
  } catch (error) {
    if (uploadedPath) {
      await deleteUploadedAsset(uploadedPath);
    }

    if (error instanceof NotFoundError) {
      return res.status(404).send(res.locals.t('errors.siteNotFound'));
    }

    logger.error({ err: error }, 'Site update failed');
    res.status(500).send(res.locals.t('errors.shortcutGeneration'));
  }
});

router.post('/:id/delete', ensureAuthenticated, verifyCsrfToken, async (req, res) => {
  const { id } = req.params;

  try {
    let deletedSite = null;

    await updateJson(SITES_FILE, (sites) => {
      const index = sites.findIndex((site) => site.id === id);
      if (index === -1) {
        throw new NotFoundError();
      }
      deletedSite = sites[index];
      return sites.filter((site) => site.id !== id);
    });

    // The uploaded asset is only actually removed once the undo window
    // expires unused, so clicking "Undo" can still show the original image.
    const undoToken = deletedSite
      ? stash({ type: 'site', item: deletedSite }, (payload) => {
          deleteUploadedAsset(payload.item.imageUrl).catch((error) => {
            logger.error({ err: error }, 'Unable to clean up asset after undo window expired');
          });
        })
      : null;

    const undoParam = undoToken ? `&undoToken=${encodeURIComponent(undoToken)}` : '';
    res.redirect(`/admin?tab=sites&status=deleted${undoParam}`);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).send(res.locals.t('errors.siteNotFound'));
    }
    throw error;
  }
});

module.exports = router;

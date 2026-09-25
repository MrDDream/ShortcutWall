const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { SITES_FILE } = require('../config');
const { ensureAuthenticated } = require('../middleware/auth');
const { readJson, writeJson } = require('../lib/store');
const { upload, buildUploadedPath, deleteUploadedAsset } = require('../lib/uploads');
const { normalizeTargetUrl, isUrlReachable } = require('../lib/urlUtils');

const router = express.Router();

router.post('/', ensureAuthenticated, upload.single('imageFile'), async (req, res) => {
  const uploadedPath = req.file ? buildUploadedPath(req.file.filename) : null;
  try {
    const { name, targetUrl } = req.body;

    const descriptionInput = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const imageUrlInput = req.body.imageUrl?.trim();

    if (!name || !targetUrl) {
      if (uploadedPath) {
        await deleteUploadedAsset(uploadedPath);
      }

      return res.status(400).send(res.locals.t('errors.missingSiteFields'));
    }

    let normalizedUrl;

    try {
      normalizedUrl = normalizeTargetUrl(targetUrl);
    } catch (error) {
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

    const sites = await readJson(SITES_FILE);

    sites.push({
      id: uuidv4(),
      name: name.trim(),
      targetUrl: normalizedUrl,
      description: descriptionInput,
      imageUrl: uploadedPath || imageUrlInput || '',
      createdAt: new Date().toISOString(),
    });

    await writeJson(SITES_FILE, sites);

    res.redirect('/admin?tab=sites&status=created');
  } catch (error) {
    console.error('Erreur lors de la création du site', error);

    if (uploadedPath) {
      await deleteUploadedAsset(uploadedPath);
    }

    res.status(500).send(res.locals.t('errors.shortcutGeneration'));
  }
});

router.post('/:id', ensureAuthenticated, upload.single('imageFile'), async (req, res) => {
  const uploadedPath = req.file ? buildUploadedPath(req.file.filename) : null;
  try {
    const { id } = req.params;
    const { name, targetUrl } = req.body;
    const descriptionInput = typeof req.body.description === 'string' ? req.body.description.trim() : undefined;
    const imageUrlInput = req.body.imageUrl?.trim();
    const sites = await readJson(SITES_FILE);
    const index = sites.findIndex((site) => site.id === id);

    if (index === -1) {
      if (uploadedPath) {
        await deleteUploadedAsset(uploadedPath);
      }
      return res.status(404).send(res.locals.t('errors.siteNotFound'));
    }

    const nextTargetUrl = targetUrl?.trim() || sites[index].targetUrl;

    let normalizedUrl;

    try {
      normalizedUrl = normalizeTargetUrl(nextTargetUrl);
    } catch (error) {
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

    const previousImage = sites[index].imageUrl;
    let nextImage = previousImage;
    let shouldDeletePrevious = false;

    if (uploadedPath) {
      nextImage = uploadedPath;
      shouldDeletePrevious = true;
    } else if (typeof req.body.imageUrl !== 'undefined') {
      nextImage = imageUrlInput || '';
      if (nextImage !== previousImage) {
        shouldDeletePrevious = true;
      }
    }

    sites[index] = {
      ...sites[index],
      name: name?.trim() || sites[index].name,
      targetUrl: normalizedUrl,
      description: typeof descriptionInput === 'undefined' ? sites[index].description || '' : descriptionInput,
      imageUrl: nextImage,
      updatedAt: new Date().toISOString(),
    };

    await writeJson(SITES_FILE, sites);

    if (shouldDeletePrevious) {
      await deleteUploadedAsset(previousImage);
    }

    res.redirect('/admin?tab=sites&status=updated');
  } catch (error) {
    console.error('Erreur lors de la mise à jour du site', error);
    if (uploadedPath) {
      await deleteUploadedAsset(uploadedPath);
    }
    res.status(500).send(res.locals.t('errors.shortcutGeneration'));
  }
});

router.post('/:id/delete', ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const sites = await readJson(SITES_FILE);
  const targetSite = sites.find((site) => site.id === id);
  const nextSites = sites.filter((site) => site.id !== id);

  if (sites.length === nextSites.length) {
    return res.status(404).send(res.locals.t('errors.siteNotFound'));
  }

  await writeJson(SITES_FILE, nextSites);
  if (targetSite) {
    await deleteUploadedAsset(targetSite.imageUrl);
  }
  res.redirect('/admin?tab=sites&status=deleted');
});

module.exports = router;

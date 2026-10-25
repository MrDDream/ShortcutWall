const crypto = require('crypto');
const express = require('express');

const { SITES_FILE } = require('../config');
const { ensureAuthenticated } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const { readJson, updateJson, NotFoundError } = require('../lib/store');
const {
  upload,
  shrinkUploadedLogo,
  isUploadedAsset,
  deleteUploadedAsset,
  InvalidFileError,
} = require('../lib/uploads');
const { importRemoteImage } = require('../lib/remoteImage');
const { normalizeTargetUrl, normalizeImageUrl, isUrlReachable } = require('../lib/urlUtils');
const { FieldError, readSiteFields } = require('../lib/siteFields');
const { stash } = require('../lib/trash');
const { deleteAssetIfUnused } = require('../lib/uploadsCleanup');
const logger = require('../lib/logger');

const router = express.Router();

// Rejects the request with a translated 400 message.
function invalid(key) {
  return new FieldError(key);
}

function parseUrl(normalize, value) {
  try {
    return normalize(value);
  } catch {
    throw invalid('errors.invalidUrl');
  }
}

// Keeps a local copy of a remote logo when possible (see importRemoteImage),
// recording the new file so a failed request can remove it again.
async function localizeLogo(imageUrl, createdFiles) {
  if (!imageUrl || isUploadedAsset(imageUrl)) {
    return imageUrl;
  }
  const imported = await importRemoteImage(imageUrl);
  if (!imported) {
    return imageUrl;
  }
  createdFiles.push(imported);
  return imported;
}

// Stores and checks the uploaded file, if any (see shrinkUploadedLogo).
async function receiveUpload(req, createdFiles) {
  if (!req.file) {
    return null;
  }
  const storedPath = await shrinkUploadedLogo(req.file.filename);
  createdFiles.push(storedPath);
  return storedPath;
}

// One place to turn a failed save into a response, after removing every file
// the request created (upload, imported logo).
async function failSave(res, error, createdFiles, logMessage) {
  await Promise.all(createdFiles.map((file) => deleteUploadedAsset(file)));

  if (error instanceof FieldError) {
    return res.status(400).send(res.locals.t(error.key));
  }
  if (error instanceof InvalidFileError) {
    return res.status(400).send(res.locals.t('errors.unsupportedFileType'));
  }
  if (error instanceof NotFoundError) {
    return res.status(404).send(res.locals.t('errors.siteNotFound'));
  }
  logger.error({ err: error }, logMessage);
  return res.status(500).send(res.locals.t('errors.shortcutGeneration'));
}

router.post('/', ensureAuthenticated, upload.single('imageFile'), verifyCsrfToken, async (req, res) => {
  const createdFiles = [];
  try {
    const uploadedPath = await receiveUpload(req, createdFiles);
    const fields = readSiteFields(req.body);
    if (!fields.name || !fields.targetUrl) {
      throw invalid('errors.missingSiteFields');
    }

    const targetUrl = parseUrl(normalizeTargetUrl, fields.targetUrl);
    let imageUrl = uploadedPath || parseUrl(normalizeImageUrl, fields.imageUrl);

    if (!(await isUrlReachable(targetUrl))) {
      throw invalid('errors.siteUnreachable');
    }
    imageUrl = await localizeLogo(imageUrl, createdFiles);

    await updateJson(SITES_FILE, (sites) => [
      ...sites,
      {
        id: crypto.randomUUID(),
        name: fields.name,
        targetUrl,
        description: fields.description || '',
        imageUrl,
        createdAt: new Date().toISOString(),
      },
    ]);

    res.redirect('/admin?status=created');
  } catch (error) {
    await failSave(res, error, createdFiles, 'Site creation failed');
  }
});

// Fields left out of the request keep their current value; an empty name or
// URL also keeps the current one, while an empty description or logo clears it.
router.post('/:id', ensureAuthenticated, upload.single('imageFile'), verifyCsrfToken, async (req, res) => {
  const createdFiles = [];
  try {
    const uploadedPath = await receiveUpload(req, createdFiles);
    const fields = readSiteFields(req.body);

    // Snapshot read for the fallbacks and the reachability check, run before
    // touching the file; the write below re-reads under the lock, so a
    // concurrent delete is still detected. Only a new address is checked: a
    // site that is down, or that only the browsers can reach, can still be
    // renamed or described.
    const currentSite = (await readJson(SITES_FILE)).find((site) => site.id === req.params.id);
    if (!currentSite) {
      throw new NotFoundError();
    }

    const targetUrl = parseUrl(normalizeTargetUrl, fields.targetUrl || currentSite.targetUrl);
    let imageUrl = currentSite.imageUrl;
    if (uploadedPath) {
      imageUrl = uploadedPath;
    } else if (fields.imageUrl !== undefined) {
      imageUrl = parseUrl(normalizeImageUrl, fields.imageUrl);
    }

    if (targetUrl !== currentSite.targetUrl && !(await isUrlReachable(targetUrl))) {
      throw invalid('errors.siteUnreachable');
    }
    imageUrl = await localizeLogo(imageUrl, createdFiles);

    await updateJson(SITES_FILE, (sites) => {
      const index = sites.findIndex((site) => site.id === req.params.id);
      if (index === -1) {
        throw new NotFoundError();
      }
      const site = sites[index];
      sites[index] = {
        ...site,
        name: fields.name || site.name,
        targetUrl,
        description: fields.description ?? site.description ?? '',
        imageUrl,
        updatedAt: new Date().toISOString(),
      };
      return sites;
    });

    // Saved: the new files are now in use, and a replaced local logo may not be.
    createdFiles.length = 0;
    if (imageUrl !== currentSite.imageUrl) {
      await deleteAssetIfUnused(currentSite.imageUrl);
    }

    res.redirect('/admin?status=updated');
  } catch (error) {
    await failSave(res, error, createdFiles, 'Site update failed');
  }
});

router.post('/:id/delete', ensureAuthenticated, verifyCsrfToken, async (req, res) => {
  let deletedSite = null;
  try {
    await updateJson(SITES_FILE, (sites) => {
      deletedSite = sites.find((site) => site.id === req.params.id);
      if (!deletedSite) {
        throw new NotFoundError();
      }
      return sites.filter((site) => site !== deletedSite);
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).send(res.locals.t('errors.siteNotFound'));
    }
    throw error;
  }

  // The logo is only actually removed once the undo window expires unused,
  // so "Undo" can still bring the site back with it.
  const undoToken = stash({ type: 'site', item: deletedSite }, (payload) => {
    deleteAssetIfUnused(payload.item.imageUrl).catch((error) => {
      logger.error({ err: error }, 'Unable to clean up asset after undo window expired');
    });
  });

  res.redirect(`/admin?status=deleted&undoToken=${encodeURIComponent(undoToken)}`);
});

module.exports = router;

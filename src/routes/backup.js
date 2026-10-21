const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const { SITES_FILE } = require('../config');
const { ensureAuthenticated } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const { readJson, updateJson } = require('../lib/store');
const { isUploadedAsset, readUploadedAsset, deleteUploadedAsset } = require('../lib/uploads');
const { saveImageBuffer } = require('../lib/remoteImage');
const { stash } = require('../lib/trash');
const { normalizeTargetUrl, normalizeImageUrl } = require('../lib/urlUtils');
const { FIELD_LIMITS, readTextField } = require('../lib/siteFields');
const logger = require('../lib/logger');

const router = express.Router();

// Backup file format: a self-contained JSON document, uploaded logos embedded
// as base64 (they're downsized to a few KB each, see images.js).
const BACKUP_APP = 'ShortcutWall';
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BACKUP_BYTES, files: 1 },
});

// multer's own errors (file too large…) would otherwise reach the generic
// error handler; answer them as the plain-text messages the import dialog shows.
function receiveBackupFile(req, res, next) {
  backupUpload.single('backupFile')(req, res, (error) => {
    if (error) {
      const key = error.code === 'LIMIT_FILE_SIZE' ? 'errors.importTooLarge' : 'errors.importInvalidFile';
      return res.status(400).send(res.locals.t(key));
    }
    next();
  });
}

router.get('/export', ensureAuthenticated, async (req, res, next) => {
  try {
    const sites = await readJson(SITES_FILE);

    const exported = await Promise.all(
      sites.map(async (site) => {
        // A local /uploads path means nothing on another install: embed the
        // bytes instead. A remote logo URL is kept as-is.
        const isLocal = isUploadedAsset(site.imageUrl);
        const image = isLocal ? await readUploadedAsset(site.imageUrl) : null;
        return {
          name: site.name,
          description: site.description || '',
          targetUrl: site.targetUrl,
          createdAt: site.createdAt || null,
          imageUrl: !isLocal && site.imageUrl ? site.imageUrl : null,
          image: image ? { data: image.toString('base64') } : null,
        };
      }),
    );

    const backup = {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      sites: exported,
    };

    res.attachment(`shortcutwall-${backup.exportedAt.slice(0, 10)}.json`);
    res.type('application/json');
    res.send(JSON.stringify(backup, null, 2));
  } catch (error) {
    next(error);
  }
});

class ImportError extends Error {
  constructor(key, vars) {
    super(key);
    this.key = key;
    this.vars = vars;
  }
}

// An ISO date string, or null for anything else (missing, malformed, or an
// arbitrarily long string that would only bloat the data file).
function parseDate(value) {
  if (typeof value !== 'string' || value.length > 40) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

// Validates the whole backup before anything is written, so a bad entry
// never leaves a half-imported list behind.
function parseBackup(file) {
  let backup;
  try {
    backup = JSON.parse(file?.buffer.toString('utf-8') ?? '');
  } catch {
    throw new ImportError('errors.importInvalidFile');
  }
  if (backup?.app !== BACKUP_APP || !Array.isArray(backup.sites) || !(backup.version <= BACKUP_VERSION)) {
    throw new ImportError('errors.importInvalidFile');
  }

  return backup.sites.map((entry) => {
    // Same limits as the forms (see siteFields.js): a backup can't sneak in
    // what the admin couldn't type.
    const text = (value, maxLength) => {
      try {
        return readTextField(value, maxLength);
      } catch {
        return null;
      }
    };
    const name = text(entry?.name, FIELD_LIMITS.name);
    const description = text(entry?.description, FIELD_LIMITS.description);
    let targetUrl = null;
    try {
      targetUrl = normalizeTargetUrl(text(entry?.targetUrl, FIELD_LIMITS.url) || '');
    } catch {
      // Reported below.
    }
    if (!name || !targetUrl || description === null) {
      throw new ImportError('errors.importInvalidSite', { name: name || '?' });
    }

    let imageUrl = '';
    try {
      imageUrl = normalizeImageUrl(text(entry.imageUrl, FIELD_LIMITS.url) || '');
    } catch {
      // An unusable logo URL just means no logo.
    }

    return {
      name,
      description,
      targetUrl,
      // Another install's /uploads path points at nothing here.
      imageUrl: isUploadedAsset(imageUrl) ? '' : imageUrl,
      imageData: typeof entry.image?.data === 'string' ? entry.image.data : null,
      createdAt: parseDate(entry.createdAt),
    };
  });
}

// "merge" (default) adds the backup's sites, skipping URLs already on the wall;
// "replace" swaps the whole list for the backup's. A replace can be undone for
// the trash window (like a deletion): the previous list and its logos are only
// discarded once that window has passed.
router.post('/import', ensureAuthenticated, receiveBackupFile, verifyCsrfToken, async (req, res) => {
  const replace = req.body.mode === 'replace';
  const savedImages = [];

  try {
    const entries = parseBackup(req.file);
    const now = new Date().toISOString();

    const seen = new Set();
    if (!replace) {
      (await readJson(SITES_FILE)).forEach((site) => seen.add(site.targetUrl));
    }

    const incoming = [];
    for (const entry of entries) {
      if (seen.has(entry.targetUrl)) {
        continue;
      }
      seen.add(entry.targetUrl);

      // An embedded logo goes through the same checks as any stored image
      // (raster formats only, downsized); one that fails them is dropped.
      const savedImage = entry.imageData ? await saveImageBuffer(Buffer.from(entry.imageData, 'base64')) : null;
      if (savedImage) {
        savedImages.push(savedImage);
      }

      incoming.push({
        id: crypto.randomUUID(),
        name: entry.name,
        targetUrl: entry.targetUrl,
        description: entry.description,
        imageUrl: savedImage || entry.imageUrl,
        createdAt: entry.createdAt || now,
      });
    }

    let previousSites = [];
    await updateJson(SITES_FILE, (sites) => {
      previousSites = sites;
      return replace ? incoming : [...sites, ...incoming];
    });

    const undoToken =
      replace && previousSites.length
        ? stash({ type: 'sites', items: previousSites }, (payload) => {
            Promise.all(payload.items.map((site) => deleteUploadedAsset(site.imageUrl))).catch((error) => {
              logger.error({ err: error }, 'Unable to clean up logos after the undo window expired');
            });
          })
        : null;
    const undoParam = undoToken ? `&undoToken=${encodeURIComponent(undoToken)}` : '';

    res.redirect(`/admin?status=imported&count=${incoming.length}${undoParam}`);
  } catch (error) {
    await Promise.all(savedImages.map((image) => deleteUploadedAsset(image)));

    if (error instanceof ImportError) {
      return res.status(400).send(res.locals.t(error.key, error.vars));
    }
    logger.error({ err: error }, 'Backup import failed');
    res.status(500).send(res.locals.t('errors.unexpected'));
  }
});

module.exports = router;

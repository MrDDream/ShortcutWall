const fs = require('fs').promises;
const path = require('path');

const { SITES_FILE, UPLOAD_DIR } = require('../config');
const { readJson } = require('./store');
const { pendingPayloads } = require('./trash');
const logger = require('./logger');

// Leaves recent files alone: a logo fetched in a still-open dialog, or one
// written moments ago, isn't referenced by any site yet.
const MIN_AGE_MS = 60 * 60 * 1000;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

function uploadedFilename(imageUrl) {
  return typeof imageUrl === 'string' && imageUrl.startsWith('/uploads/') ? path.basename(imageUrl) : null;
}

// Deletes files in the upload directory that no site (nor any item waiting in
// its undo window) references and that are older than MIN_AGE_MS — typically
// favicons fetched in a dialog that was then cancelled. Nothing is deleted if
// the sites can't be read or the list is empty: an unmounted or misconfigured
// data volume must never wipe every logo. Returns the removed file names.
async function removeOrphanUploads({ uploadDir = UPLOAD_DIR, sitesFile = SITES_FILE, now = Date.now() } = {}) {
  const sites = await readJson(sitesFile);
  if (!Array.isArray(sites) || !sites.length) {
    return [];
  }
  const items = [...sites, ...pendingPayloads().map((payload) => payload?.item)];
  const referenced = new Set(items.map((item) => uploadedFilename(item?.imageUrl)).filter(Boolean));

  let names;
  try {
    names = await fs.readdir(uploadDir);
  } catch {
    return [];
  }

  const removed = [];
  for (const name of names) {
    if (referenced.has(name) || name.startsWith('.')) {
      continue;
    }
    const filePath = path.join(uploadDir, name);
    const stats = await fs.stat(filePath).catch(() => null);
    if (!stats?.isFile() || now - stats.mtimeMs < MIN_AGE_MS) {
      continue;
    }
    try {
      await fs.unlink(filePath);
      removed.push(name);
    } catch (error) {
      logger.warn({ err: error, file: name }, 'Unable to remove orphan upload');
    }
  }

  if (removed.length) {
    logger.info({ files: removed }, `Removed ${removed.length} orphan upload(s)`);
  }
  return removed;
}

// Runs the cleanup now, then once a day, without keeping the process alive.
function scheduleOrphanUploadsCleanup() {
  const run = () =>
    removeOrphanUploads().catch((error) => logger.error({ err: error }, 'Orphan uploads cleanup failed'));
  run();
  setInterval(run, INTERVAL_MS).unref();
}

module.exports = { removeOrphanUploads, scheduleOrphanUploadsCleanup, MIN_AGE_MS };

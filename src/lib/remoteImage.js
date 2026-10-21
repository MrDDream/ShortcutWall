const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const { UPLOAD_DIR } = require('../config');
const httpClient = require('./httpClient');
const { buildUploadedPath } = require('./uploads');
const { shrinkLogo, detectImageType } = require('./images');

// Same cap as manual uploads (see uploads.js).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Stores image bytes (a download, a backup being imported) in /uploads and
// returns the local path, or null if they aren't a supported raster image or
// exceed MAX_IMAGE_BYTES. Oversized logos are stored downsized (see
// shrinkLogo); ICO icons are small by nature and not decodable by sharp, so
// they are kept as-is.
async function saveImageBuffer(buffer) {
  if (!buffer || buffer.length > MAX_IMAGE_BYTES) {
    return null;
  }
  const type = detectImageType(buffer);
  if (!type) {
    return null;
  }

  const shrunk = type === 'ico' ? null : await shrinkLogo(buffer);
  const extension = shrunk ? 'webp' : type;

  const filename = `logo-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), shrunk || buffer);
  return buildUploadedPath(filename);
}

// Downloads a remote image into /uploads (downsized if oversized) and returns
// its local path, or null
// when it can't be fetched or isn't a supported raster image (callers then keep
// the remote URL). Serving logos from the app itself means a site's hotlink
// protection or a "Cross-Origin-Resource-Policy: same-site" header — which
// makes browsers refuse to show its images on any other site — can't break the
// wall, and viewers' browsers no longer contact third-party sites at all.
async function importRemoteImage(remoteUrl) {
  try {
    const response = await httpClient.request(remoteUrl, { maxBytes: MAX_IMAGE_BYTES });
    return response.ok ? await saveImageBuffer(response.body) : null;
  } catch {
    // Blocked host, network error, timeout or oversized file: keep the URL.
    return null;
  }
}

module.exports = { importRemoteImage, saveImageBuffer };

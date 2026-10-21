const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const { UPLOAD_DIR } = require('../config');
const httpClient = require('./httpClient');
const { buildUploadedPath } = require('./uploads');
const { shrinkLogo } = require('./imageResize');

// Same cap as manual uploads (see uploads.js).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Identifies the format from the file's first bytes instead of trusting the
// remote Content-Type. Raster formats only: SVG (or anything else) is refused
// for the same stored-XSS reason as manual uploads, since /uploads is served
// from the app's own origin.
function detectImageType(buffer) {
  const startsWith = (bytes, offset = 0) => bytes.every((byte, index) => buffer[offset + index] === byte);

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'png';
  }
  if (startsWith([0xff, 0xd8, 0xff])) {
    return 'jpg';
  }
  if (startsWith([0x47, 0x49, 0x46, 0x38])) {
    return 'gif';
  }
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }
  if (startsWith([0x00, 0x00, 0x01, 0x00])) {
    return 'ico';
  }
  return null;
}

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

module.exports = { importRemoteImage, saveImageBuffer, detectImageType };

const fs = require('fs').promises;
const path = require('path');

const { UPLOAD_DIR } = require('../config');
const httpClient = require('./httpClient');
const { MAX_LOGO_BYTES, generateLogoFilename, buildUploadedPath } = require('./uploads');
const { shrinkLogo, detectImageType, isSvg, rasterizeSvg } = require('./images');

// The bytes to store for a logo and their extension, or null when they aren't
// a supported image. An SVG is rendered to WebP (see rasterizeSvg); an
// oversized raster is downsized (see shrinkLogo); an ICO icon is small by
// nature and not decodable by sharp, so it is kept as-is.
async function encodeLogo(buffer) {
  if (isSvg(buffer)) {
    const rendered = await rasterizeSvg(buffer);
    return rendered && { bytes: rendered, extension: 'webp' };
  }
  const type = detectImageType(buffer);
  if (!type) {
    return null;
  }
  const shrunk = type === 'ico' ? null : await shrinkLogo(buffer);
  return shrunk ? { bytes: shrunk, extension: 'webp' } : { bytes: buffer, extension: type };
}

// Stores image bytes (a download, a backup being imported) in /uploads and
// returns the local path, or null if they aren't a supported image or exceed
// MAX_LOGO_BYTES.
async function saveImageBuffer(buffer) {
  if (!buffer || buffer.length > MAX_LOGO_BYTES) {
    return null;
  }
  const logo = await encodeLogo(buffer);
  if (!logo) {
    return null;
  }
  const filename = generateLogoFilename(`.${logo.extension}`);
  await fs.writeFile(path.join(UPLOAD_DIR, filename), logo.bytes);
  return buildUploadedPath(filename);
}

// Downloads a remote image into /uploads and returns its local path, or null
// when it can't be fetched or isn't a supported image (callers then keep the
// remote URL). Serving logos from the app itself means a site's hotlink
// protection or a "Cross-Origin-Resource-Policy: same-site" header — which
// makes browsers refuse to show its images on any other site — can't break the
// wall, and viewers' browsers no longer contact third-party sites at all.
// `signal` cancels the download (see routes/favicon.js).
async function importRemoteImage(remoteUrl, { signal } = {}) {
  try {
    const response = await httpClient.request(remoteUrl, { maxBytes: MAX_LOGO_BYTES, signal });
    return response.ok ? await saveImageBuffer(response.body) : null;
  } catch {
    // Blocked host, network error, timeout or oversized file: keep the URL.
    return null;
  }
}

module.exports = { importRemoteImage, saveImageBuffer };

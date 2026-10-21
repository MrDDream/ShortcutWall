const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const { FAVICON_FETCH_TIMEOUT, UPLOAD_DIR } = require('../config');
const { assertPublicHost } = require('./ssrfGuard');
const { buildUploadedPath } = require('./uploads');

const USER_AGENT = 'Mozilla/5.0 ShortcutWall/1.0';
// Same cap as manual uploads (see uploads.js).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// Covers the whole download, body included, not just the response headers.
const IMPORT_TIMEOUT = FAVICON_FETCH_TIMEOUT * 2;

// fetch() with the app's timeout and user agent. Rejects non-public hosts up
// front to prevent SSRF (see ssrfGuard.js). The timeout only covers the
// response headers: callers reading a body must bound it themselves.
async function guardedFetch(resourceUrl, options = {}) {
  await assertPublicHost(resourceUrl.toString());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FAVICON_FETCH_TIMEOUT);

  try {
    return await fetch(resourceUrl, {
      redirect: 'follow',
      ...options,
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, ...(options.headers || {}) },
    });
  } finally {
    clearTimeout(timeout);
  }
}

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

// Reads a response body, giving up (null) as soon as it exceeds `limit`.
async function readCapped(response, limit) {
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return Buffer.concat(chunks);
    }
    size += value.length;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
}

// Downloads a remote image into /uploads and returns its local path, or null
// when it can't be fetched or isn't a supported raster image (callers then keep
// the remote URL). Serving logos from the app itself means a site's hotlink
// protection or a "Cross-Origin-Resource-Policy: same-site" header — which
// makes browsers refuse to show its images on any other site — can't break the
// wall, and viewers' browsers no longer contact third-party sites at all.
async function importRemoteImage(remoteUrl) {
  let url;
  try {
    url = new URL(remoteUrl);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMPORT_TIMEOUT);

  try {
    await assertPublicHost(url.toString());

    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });

    const declaredSize = Number(response.headers.get('content-length'));
    if (!response.ok || !response.body || declaredSize > MAX_IMAGE_BYTES) {
      await response.body?.cancel().catch(() => {});
      return null;
    }

    const buffer = await readCapped(response, MAX_IMAGE_BYTES);
    const type = buffer && detectImageType(buffer);
    if (!type) {
      return null;
    }

    const filename = `logo-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${type}`;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
    return buildUploadedPath(filename);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { guardedFetch, importRemoteImage, detectImageType };

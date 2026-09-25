const { FAVICON_FETCH_TIMEOUT } = require('../config');
const { assertPublicHost } = require('./ssrfGuard');

// Checks and normalises the URL entered by the user, throwing an error if it's invalid or unsupported.
function normalizeTargetUrl(value) {
  if (!value || !value.trim()) {
    throw new Error('URL manquante.');
  }

  const url = new URL(value.trim());

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Protocole non supporté.');
  }

  return url.toString();
}

function toDosPath(input) {
  return input
    .replace(/^\s+|\s+$/g, '')
    .replace(/\//g, '\\')
    .replace(/\\\\+/g, '\\\\');
}

function normalizeNetworkPath(value = '') {
  if (!value) {
    return '';
  }
  const target = value.trim();
  if (!target) {
    return '';
  }
  if (target.startsWith('file://')) {
    return target;
  }
  if (target.startsWith('\\\\')) {
    return toDosPath(target);
  }
  if (/^[a-zA-Z]:[\\/]/.test(target)) {
    return toDosPath(target);
  }
  return target;
}

// Special case for 401 and 403, which are considered reachable even though they indicate restricted access.
function isReachableStatus(status) {
  return (status >= 200 && status < 400) || status === 401 || status === 403;
}

// Sends requests to websites to verify their reachability, using a HEAD request
// first and falling back to GET if necessary (some servers reject HEAD outright).
// Rejects non-public hosts up front to prevent SSRF (see ssrfGuard.js).
async function isUrlReachable(targetUrl) {
  try {
    await assertPublicHost(targetUrl);
  } catch (error) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FAVICON_FETCH_TIMEOUT);

  const requestOptions = {
    signal: controller.signal,
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 ShortcutWall/1.0',
    },
  };

  try {
    const headResponse = await fetch(targetUrl, {
      ...requestOptions,
      method: 'HEAD',
    });

    if (isReachableStatus(headResponse.status)) {
      return true;
    }

    const getResponse = await fetch(targetUrl, {
      ...requestOptions,
      method: 'GET',
    });

    return isReachableStatus(getResponse.status);
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// A previously uploaded asset reference must be exactly one path segment
// under /uploads/ (no "/" or "\"), which rules out any "../" traversal.
function isSafeStoredImagePath(value) {
  return /^\/uploads\/[^/\\]+$/.test(value);
}

// Validates a user-supplied image reference: either a safe reference to a
// previously uploaded asset, or a proper http(s) URL. Throws otherwise, so
// callers can reject anything else (in particular, this is what stops a
// crafted "/uploads/../../../etc/passwd" value from ever being stored).
function normalizeImageUrl(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return '';
  }
  if (isSafeStoredImagePath(trimmed)) {
    return trimmed;
  }
  return normalizeTargetUrl(trimmed);
}

module.exports = { normalizeTargetUrl, normalizeNetworkPath, normalizeImageUrl, isUrlReachable };

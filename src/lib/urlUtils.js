const httpClient = require('./httpClient');

// Checks and normalises a user-entered URL; throws if it's invalid or not http(s).
function normalizeTargetUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Missing URL.');
  }

  const url = new URL(value.trim());

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Unsupported protocol.');
  }

  return url.toString();
}

// Special case for 401 and 403, which are considered reachable even though they indicate restricted access.
function isReachableStatus(status) {
  return (status >= 200 && status < 400) || status === 401 || status === 403;
}

// Sends requests to websites to verify their reachability, using a HEAD request
// first and falling back to GET if necessary (some servers reject HEAD outright).
// Blocked hosts (directly or through a redirect) count as unreachable: see
// httpClient.js.
async function isUrlReachable(targetUrl, { signal } = {}) {
  try {
    const head = await httpClient.request(targetUrl, { method: 'HEAD', signal });
    if (isReachableStatus(head.status)) {
      return true;
    }
    const get = await httpClient.request(targetUrl, { method: 'GET', signal });
    return isReachableStatus(get.status);
  } catch {
    return false;
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

module.exports = { normalizeTargetUrl, normalizeImageUrl, isUrlReachable };

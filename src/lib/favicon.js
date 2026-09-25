const { FAVICON_FETCH_TIMEOUT } = require('../config');
const { assertPublicHost } = require('./ssrfGuard');

// Checks if a resource exists by sending a HEAD request, and falls back to GET if necessary.
// Rejects non-public hosts up front to prevent SSRF (see ssrfGuard.js); this is
// redundant with the reachability check already performed by the caller, kept
// here as defense in depth so this function stays safe to call on its own.
async function resourceExists(resourceUrl) {
  try {
    await assertPublicHost(resourceUrl.toString());
  } catch {
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
    let response = await fetch(resourceUrl, {
      ...requestOptions,
      method: 'HEAD',
    });

    if (response.status === 405 || response.status === 501) {
      response = await fetch(resourceUrl, {
        ...requestOptions,
        method: 'GET',
      });

      return response.ok;
    }

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// Extracts the favicon URL from the HTML content of a webpage, if declared in a <link> tag.
function extractFaviconFromHtml(html, baseUrl) {
  const linkRegex = /<link\b[^>]*>/gi;
  const links = html.match(linkRegex) || [];

  for (const link of links) {
    const relMatch = link.match(/\brel\s*=\s*["']([^"']+)["']/i);
    const hrefMatch = link.match(/\bhref\s*=\s*["']([^"']+)["']/i);

    if (!relMatch || !hrefMatch) {
      continue;
    }

    const relValues = relMatch[1].toLowerCase().split(/\s+/);
    const isFavicon = relValues.includes('icon') || (relValues.includes('shortcut') && relValues.includes('icon'));

    if (!isFavicon) {
      continue;
    }

    try {
      return new URL(hrefMatch[1], baseUrl).toString();
    } catch {
      continue;
    }
  }

  return null;
}

// Attempts to fetch the favicon declared in the HTML of the target URL.
async function findDeclaredFavicon(targetUrl) {
  try {
    await assertPublicHost(targetUrl);
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FAVICON_FETCH_TIMEOUT);

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 ShortcutWall/1.0',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return extractFaviconFromHtml(html, targetUrl);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Try retrieving the favicon via Google if the other methods do not work.
function buildGoogleFaviconUrl(targetUrl) {
  const url = new URL(targetUrl);
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url.origin)}&sz=128`;
}

// Attempts to retrieve the favicon using several fallback methods, in order of preference.
async function findFavicon(targetUrl) {
  const pageFavicon = await findDeclaredFavicon(targetUrl);

  if (pageFavicon) {
    return pageFavicon;
  }

  const defaultFavicon = new URL('/favicon.ico', targetUrl);
  const defaultFaviconExists = await resourceExists(defaultFavicon);

  if (defaultFaviconExists) {
    return defaultFavicon.toString();
  }

  return buildGoogleFaviconUrl(targetUrl);
}

module.exports = { findFavicon };

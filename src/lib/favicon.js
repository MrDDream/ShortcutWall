const { FAVICON_FETCH_TIMEOUT } = require('../config');
const { assertPublicHost } = require('./ssrfGuard');

const USER_AGENT = 'Mozilla/5.0 ShortcutWall/1.0';
// Only the best few icons are probed, to bound the request count.
const MAX_CANDIDATES_CHECKED = 5;
// Conventional locations, probed even when the page doesn't declare them:
// many sites serve a 180px apple-touch-icon but only declare a 16px .ico.
const CONVENTIONAL_ICONS = [
  { path: '/apple-touch-icon.png', score: 180 },
  { path: '/favicon.ico', score: 16 },
];
const IMAGE_EXTENSION = /\.(ico|png|svg|jpe?g|gif|webp|avif)$/i;

// fetch() with the app's timeout and user agent. Rejects non-public hosts up
// front to prevent SSRF (see ssrfGuard.js).
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

// Servers label icons inconsistently (an .ico is often served as
// application/octet-stream), so trust the extension when the type is
// generic, but never accept an HTML page (soft 404s, login walls, bot
// challenges all answer 200/403 with HTML).
function looksLikeImage(response, resourceUrl) {
  const type = (response.headers.get('content-type') || '').toLowerCase();
  if (type.startsWith('image/')) {
    return true;
  }
  if (type.includes('html') || type.includes('json') || type.startsWith('text/')) {
    return false;
  }
  return IMAGE_EXTENSION.test(new URL(resourceUrl).pathname);
}

// True when the URL answers with an actual image. Tries HEAD first and only
// falls back to GET (discarding the body) when HEAD is refused or inconclusive.
async function imageExists(resourceUrl) {
  try {
    const head = await guardedFetch(resourceUrl, { method: 'HEAD' });
    if (head.ok && looksLikeImage(head, resourceUrl)) {
      return true;
    }
    if (head.ok || ![403, 405, 501].includes(head.status)) {
      return false;
    }

    const get = await guardedFetch(resourceUrl, { method: 'GET' });
    const valid = get.ok && looksLikeImage(get, resourceUrl);
    await get.body?.cancel().catch(() => {});
    return valid;
  } catch {
    return false;
  }
}

function readAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
  if (!match) {
    return null;
  }
  return (match[1] ?? match[2] ?? match[3]).replace(/&amp;/gi, '&').trim();
}

// Rough pixel size used to rank icons: the largest raster wins, an SVG (or
// sizes="any") beats any raster, and an undeclared size gets a guess based on
// what that kind of icon usually is.
function scoreIcon({ rel, href, sizes, type }) {
  const isSvg = /svg/i.test(type || '') || /\.svg(\?|#|$)/i.test(href);
  if (isSvg || /\bany\b/i.test(sizes || '')) {
    return 1000;
  }

  const declared = (sizes || '')
    .split(/\s+/)
    .map((size) => Number.parseInt(size.split(/x/i)[0], 10))
    .filter(Number.isFinite);
  if (declared.length) {
    return Math.max(...declared);
  }

  if (rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')) {
    return 180;
  }
  return /\.ico(\?|#|$)/i.test(href) ? 16 : 32;
}

// Lists every icon declared in the page's <link> tags as { url, score },
// best (largest) first.
function extractFaviconCandidates(html, baseUrl) {
  const links = html.match(/<link\b[^>]*>/gi) || [];
  const candidates = [];

  for (const tag of links) {
    const rel = (readAttribute(tag, 'rel') || '').toLowerCase().split(/\s+/);
    const href = readAttribute(tag, 'href');
    const isIcon =
      rel.includes('icon') || rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed');
    if (!isIcon || !href || href.startsWith('data:')) {
      continue;
    }

    let url;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      continue;
    }

    const candidate = {
      rel,
      href: url.toString(),
      sizes: readAttribute(tag, 'sizes'),
      type: readAttribute(tag, 'type'),
    };
    candidates.push({ url: candidate.href, score: scoreIcon(candidate) });
  }

  return dedupeByUrl(candidates.sort((a, b) => b.score - a.score));
}

function dedupeByUrl(candidates) {
  const seen = new Set();
  return candidates.filter(({ url }) => !seen.has(url) && seen.add(url));
}

// Fetches the page and returns its declared icons, resolved against the final
// URL after redirects (a relative href means nothing against the typed URL
// once the site has redirected elsewhere).
async function findDeclaredFavicons(targetUrl) {
  try {
    const response = await guardedFetch(targetUrl, { method: 'GET' });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return [];
    }
    const html = await response.text();
    return extractFaviconCandidates(html, response.url || targetUrl);
  } catch {
    return [];
  }
}

// Last resort: Google's favicon service, which answers 404 (with a generic
// globe image) when it knows no icon for the domain.
function buildGoogleFaviconUrl(targetUrl) {
  const url = new URL(targetUrl);
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url.origin)}&sz=128`;
}

// Returns the best verified icon URL for a site, or null when none is found:
// declared and conventional icons ranked together by size (largest first,
// declared ones winning ties), each checked to really be an image, then Google.
async function findFavicon(targetUrl) {
  const declared = await findDeclaredFavicons(targetUrl);
  const conventional = CONVENTIONAL_ICONS.map(({ path, score }) => ({
    url: new URL(path, targetUrl).toString(),
    score,
  }));
  const ranked = dedupeByUrl([...declared, ...conventional]).sort((a, b) => b.score - a.score);

  for (const { url } of ranked.slice(0, MAX_CANDIDATES_CHECKED)) {
    if (await imageExists(url)) {
      return url;
    }
  }

  const google = buildGoogleFaviconUrl(targetUrl);
  return (await imageExists(google)) ? google : null;
}

module.exports = { findFavicon, extractFaviconCandidates };

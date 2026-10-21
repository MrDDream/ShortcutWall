const { Agent, fetch } = require('undici');

const { HTTP_TIMEOUT_MS } = require('../config');
const { isBlockedAddress, createGuardedLookup, BlockedHostError } = require('./ssrfGuard');

const USER_AGENT = 'Mozilla/5.0 ShortcutWall/1.0';
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

class ResponseTooLargeError extends Error {}

function hostIpLiteral(url) {
  // URL keeps IPv6 literals in brackets: [::1]
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return { address: hostname, family: 4 };
  }
  return hostname.includes(':') ? { address: hostname, family: 6 } : null;
}

// Reads a response body, failing as soon as it exceeds `maxBytes`.
async function readCapped(body, maxBytes) {
  const reader = body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return Buffer.concat(chunks);
    }
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ResponseTooLargeError(`Response larger than ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
}

// The single way this app talks to the outside world (reachability checks,
// favicon discovery, logo imports). Every connection, redirects included, is
// checked against the SSRF blocklist when the socket is opened; redirects are
// followed by hand so each hop's IP-literal host is checked too (literals never
// go through DNS). One timeout covers the whole exchange, body included, and
// bodies are capped, so a huge or endless response can't exhaust memory or
// hang a request. `isBlocked` exists for tests only.
function createHttpClient({ isBlocked = isBlockedAddress, timeoutMs = HTTP_TIMEOUT_MS } = {}) {
  const dispatcher = new Agent({ connect: { lookup: createGuardedLookup(isBlocked) }, connections: 16 });

  // Returns { status, ok, headers, url, body }: `url` is the final URL after
  // redirects; `body` is a Buffer when `maxBytes` is given, otherwise null and
  // the body is discarded. Throws on blocked hosts, network errors, timeouts
  // and oversized bodies.
  async function request(target, { method = 'GET', maxBytes = null } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let url = new URL(target);
      for (let hop = 0; ; hop += 1) {
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new BlockedHostError(`Unsupported protocol: ${url.protocol}`);
        }
        const literal = hostIpLiteral(url);
        if (literal && isBlocked(literal.address, literal.family)) {
          throw new BlockedHostError(`Blocked non-public address: ${literal.address}`);
        }

        const response = await fetch(url, {
          method,
          redirect: 'manual',
          dispatcher,
          signal: controller.signal,
          headers: { 'User-Agent': USER_AGENT },
        }).catch((error) => {
          // undici reports a refused connection as a generic "fetch failed":
          // surface the guard's own error instead.
          throw error?.cause instanceof BlockedHostError ? error.cause : error;
        });

        const location = response.headers.get('location');
        if (REDIRECT_STATUSES.has(response.status) && location) {
          await response.body?.cancel().catch(() => {});
          if (hop >= MAX_REDIRECTS) {
            throw new Error('Too many redirects');
          }
          url = new URL(location, url);
          continue;
        }

        let body = null;
        if (maxBytes !== null && method !== 'HEAD' && response.body) {
          body = await readCapped(response.body, maxBytes);
        } else {
          await response.body?.cancel().catch(() => {});
        }

        return { status: response.status, ok: response.ok, headers: response.headers, url: url.toString(), body };
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return { request };
}

module.exports = { ...createHttpClient(), createHttpClient, ResponseTooLargeError };

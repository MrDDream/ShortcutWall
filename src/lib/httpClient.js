const { Agent, fetch } = require('undici');

const { HTTP_TIMEOUT_MS } = require('../config');
const { isBlockedAddress, isPrivateNetworkAddress, createGuardedLookup, BlockedHostError } = require('./ssrfGuard');

const USER_AGENT = 'Mozilla/5.0 ShortcutWall/1.0';
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// TLS failures caused by the certificate itself (self-signed, private CA,
// expired, or issued for a name rather than the IP typed), as opposed to a
// failed connection.
const CERTIFICATE_ERROR_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

function isCertificateError(error) {
  return CERTIFICATE_ERROR_CODES.has(error?.cause?.code ?? error?.code);
}

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
// hang a request. Internal sites often use a self-signed certificate: when a
// certificate is refused, the request is retried without verifying it, through
// a dispatcher that can only connect to private-network addresses (public sites
// are always verified). `isBlocked` and `isPrivate` exist for tests only.
function createHttpClient({
  isBlocked = isBlockedAddress,
  isPrivate = isPrivateNetworkAddress,
  timeoutMs = HTTP_TIMEOUT_MS,
} = {}) {
  const dispatcher = new Agent({ connect: { lookup: createGuardedLookup(isBlocked) }, connections: 16 });
  const isNotAllowedPrivate = (address, family) => isBlocked(address, family) || !isPrivate(address, family);
  const privateNetworkDispatcher = new Agent({
    connect: { lookup: createGuardedLookup(isNotAllowedPrivate), rejectUnauthorized: false },
    connections: 4,
  });

  function send(url, method, signal, via) {
    return fetch(url, {
      method,
      redirect: 'manual',
      dispatcher: via,
      signal,
      headers: { 'User-Agent': USER_AGENT },
    }).catch((error) => {
      // undici reports a refused connection as a generic "fetch failed":
      // surface the guard's own error instead.
      throw error?.cause instanceof BlockedHostError ? error.cause : error;
    });
  }

  async function sendAllowingPrivateCertificates(url, method, signal) {
    try {
      return await send(url, method, signal, dispatcher);
    } catch (error) {
      const literal = hostIpLiteral(url);
      if (!isCertificateError(error) || (literal && isNotAllowedPrivate(literal.address, literal.family))) {
        throw error;
      }
      // A host name resolving to a public address is refused by the retry's
      // lookup: report the original certificate problem instead.
      return send(url, method, signal, privateNetworkDispatcher).catch((retryError) => {
        throw retryError instanceof BlockedHostError ? error : retryError;
      });
    }
  }

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

        const response = await sendAllowingPrivateCertificates(url, method, controller.signal);

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

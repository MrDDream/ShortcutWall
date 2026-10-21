import http from 'http';
import { createRequire } from 'module';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Loaded through require() like the app does, so error classes are the same
// instances the client throws (an ESM import would load separate copies).
const require = createRequire(import.meta.url);
const httpClientModule = require('../../src/lib/httpClient.js');
const { BlockedHostError } = require('../../src/lib/ssrfGuard.js');

const { createHttpClient, ResponseTooLargeError } = httpClientModule;

// Local test servers live on loopback, which the real guard blocks: this client
// allows exactly 127.0.0.1 and blocks every other non-public address, so the
// tests can tell "followed" from "refused".
const client = createHttpClient({
  isBlocked: (address) => address !== '127.0.0.1' && address !== '::ffff:127.0.0.1',
  timeoutMs: 500,
});

let server;
let base;
let port;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const target = new URL(req.url, 'http://127.0.0.1');
    switch (target.pathname) {
      case '/ok':
        res.end('hello');
        break;
      case '/redirect':
        res.writeHead(302, { location: target.searchParams.get('to') });
        res.end();
        break;
      case '/loop':
        res.writeHead(302, { location: '/loop' });
        res.end();
        break;
      case '/big':
        res.end('x'.repeat(10_000));
        break;
      case '/slow-body':
        res.writeHead(200);
        res.write('partial');
        // never ends: only the client's overall timeout can stop it
        break;
      default:
        res.writeHead(404);
        res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  base = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe('httpClient.request', () => {
  it('follows redirects to allowed hosts and reports the final URL', async () => {
    const res = await client.request(`${base}/redirect?to=/ok`, { maxBytes: 100 });
    expect(res.status).toBe(200);
    expect(res.url).toBe(`${base}/ok`);
    expect(res.body.toString()).toBe('hello');
  });

  it('refuses a redirect to a blocked IP literal', async () => {
    await expect(client.request(`${base}/redirect?to=http://127.0.0.2:${port}/ok`)).rejects.toBeInstanceOf(
      BlockedHostError,
    );
  });

  it('checks the address of a host name at connection time (covers redirects and DNS rebinding)', async () => {
    // A name, not an IP literal: only the guarded DNS lookup, run when the
    // socket opens, can refuse it.
    const blockEverything = createHttpClient({ isBlocked: () => true, timeoutMs: 500 });
    await expect(blockEverything.request(`http://localhost:${port}/ok`)).rejects.toBeInstanceOf(BlockedHostError);
  });

  it('refuses non-http(s) redirect targets', async () => {
    await expect(client.request(`${base}/redirect?to=file:///etc/passwd`)).rejects.toBeInstanceOf(BlockedHostError);
  });

  it('gives up on redirect loops', async () => {
    await expect(client.request(`${base}/loop`)).rejects.toThrow(/Too many redirects/);
  });

  it('caps the body size', async () => {
    await expect(client.request(`${base}/big`, { maxBytes: 1000 })).rejects.toBeInstanceOf(ResponseTooLargeError);
  });

  it('times out on a body that never ends', async () => {
    const started = Date.now();
    await expect(client.request(`${base}/slow-body`, { maxBytes: 1000 })).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('the default client refuses loopback outright', async () => {
    await expect(httpClientModule.request(`${base}/ok`)).rejects.toBeInstanceOf(BlockedHostError);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('dns', () => {
  const promises = { lookup: vi.fn() };
  return { default: { promises }, promises };
});

import dns from 'dns';
import { assertPublicHost, BlockedHostError } from '../../src/lib/ssrfGuard.js';

describe('ssrfGuard.assertPublicHost', () => {
  beforeEach(() => {
    dns.promises.lookup.mockReset();
  });

  it('allows a public IPv4 address', async () => {
    dns.promises.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    await expect(assertPublicHost('https://example.com')).resolves.toBeUndefined();
  });

  it('blocks loopback addresses', async () => {
    dns.promises.lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    await expect(assertPublicHost('http://localhost')).rejects.toBeInstanceOf(BlockedHostError);
  });

  it('blocks private network ranges (10.x, 172.16-31.x, 192.168.x)', async () => {
    for (const address of ['10.0.0.5', '172.20.3.4', '192.168.1.1']) {
      dns.promises.lookup.mockResolvedValue([{ address, family: 4 }]);
      await expect(assertPublicHost(`http://${address}`)).rejects.toBeInstanceOf(BlockedHostError);
    }
  });

  it('blocks the cloud metadata link-local address', async () => {
    dns.promises.lookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    await expect(assertPublicHost('http://169.254.169.254/latest/meta-data/')).rejects.toBeInstanceOf(BlockedHostError);
  });

  it('does not block a public address adjacent to a private range (regression test)', async () => {
    // 172.66.147.243 sits just outside 172.16.0.0/12 (172.16-172.31). An earlier
    // version of the blocklist also registered an "::ffff:0:0/96" IPv6 rule,
    // which made net.BlockList match *every* plain IPv4 address through its
    // internal mapped-address normalisation and blocked all public traffic.
    dns.promises.lookup.mockResolvedValue([{ address: '172.66.147.243', family: 4 }]);
    await expect(assertPublicHost('https://example.com')).resolves.toBeUndefined();
  });

  it('unwraps and blocks an IPv4-mapped IPv6 loopback literal', async () => {
    dns.promises.lookup.mockResolvedValue([{ address: '::ffff:127.0.0.1', family: 6 }]);
    await expect(assertPublicHost('http://mapped-loopback/')).rejects.toBeInstanceOf(BlockedHostError);
  });

  it('blocks IPv6 loopback and unique-local addresses', async () => {
    dns.promises.lookup.mockResolvedValue([{ address: '::1', family: 6 }]);
    await expect(assertPublicHost('http://ipv6-loopback/')).rejects.toBeInstanceOf(BlockedHostError);

    dns.promises.lookup.mockResolvedValue([{ address: 'fd12:3456:789a::1', family: 6 }]);
    await expect(assertPublicHost('http://ipv6-unique-local/')).rejects.toBeInstanceOf(BlockedHostError);
  });

  it('rejects when DNS resolution fails', async () => {
    dns.promises.lookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertPublicHost('http://does-not-resolve.invalid')).rejects.toBeInstanceOf(BlockedHostError);
  });

  it('rejects when DNS resolution returns no address', async () => {
    dns.promises.lookup.mockResolvedValue([]);
    await expect(assertPublicHost('http://empty-resolution.invalid')).rejects.toBeInstanceOf(BlockedHostError);
  });
});

import { describe, it, expect } from 'vitest';

import {
  isBlockedAddress,
  isPrivateNetworkAddress,
  createGuardedLookup,
  BlockedHostError,
} from '../../src/lib/ssrfGuard.js';

const PRIVATE_ADDRESSES = [
  ['10.0.0.5', 4],
  ['172.20.3.4', 4],
  ['192.168.1.1', 4],
  ['100.64.0.1', 4],
  ['fd12:3456:789a::1', 6],
  ['::ffff:192.168.1.1', 6],
];

describe('ssrfGuard.isBlockedAddress', () => {
  it('allows public IPv4 and IPv6 addresses', () => {
    expect(isBlockedAddress('93.184.216.34', 4)).toBe(false);
    expect(isBlockedAddress('2606:2800:220:1:248:1893:25c8:1946', 6)).toBe(false);
  });

  it('always blocks loopback and the "this" network', () => {
    for (const address of ['127.0.0.1', '0.0.0.0']) {
      expect(isBlockedAddress(address, 4, { allowPrivate: true }), address).toBe(true);
    }
  });

  it('blocks private networks only when they are not allowed', () => {
    for (const [address, family] of PRIVATE_ADDRESSES) {
      expect(isBlockedAddress(address, family, { allowPrivate: true }), address).toBe(false);
      expect(isBlockedAddress(address, family, { allowPrivate: false }), address).toBe(true);
    }
  });

  it('blocks the cloud metadata link-local address, even with private networks allowed', () => {
    expect(isBlockedAddress('169.254.169.254', 4, { allowPrivate: true })).toBe(true);
  });

  it('does not block a public address adjacent to a private range (regression test)', () => {
    // 172.66.147.243 sits just outside 172.16.0.0/12 (172.16-172.31). An earlier
    // version of the blocklist also registered an "::ffff:0:0/96" IPv6 rule,
    // which made net.BlockList match *every* plain IPv4 address through its
    // internal mapped-address normalisation and blocked all public traffic.
    expect(isBlockedAddress('172.66.147.243', 4)).toBe(false);
  });

  it('unwraps and blocks an IPv4-mapped IPv6 private address', () => {
    expect(isBlockedAddress('::ffff:127.0.0.1', 6)).toBe(true);
    expect(isBlockedAddress('::ffff:93.184.216.34', 6)).toBe(false);
  });

  it('blocks IPv6 loopback, link-local, NAT64 and 6to4 addresses, even with private networks allowed', () => {
    for (const address of ['::1', 'fe80::1', '64:ff9b::a9fe:a9fe', '2002:c0a8:101::1']) {
      expect(isBlockedAddress(address, 6, { allowPrivate: true }), address).toBe(true);
    }
  });
});

describe('ssrfGuard.isPrivateNetworkAddress', () => {
  it('recognises private, carrier-grade NAT and unique-local addresses', () => {
    for (const [address, family] of PRIVATE_ADDRESSES) {
      expect(isPrivateNetworkAddress(address, family), address).toBe(true);
    }
  });

  it('does not count public, loopback or link-local addresses as private', () => {
    for (const [address, family] of [
      ['93.184.216.34', 4],
      ['127.0.0.1', 4],
      ['169.254.169.254', 4],
      ['fe80::1', 6],
    ]) {
      expect(isPrivateNetworkAddress(address, family), address).toBe(false);
    }
  });
});

describe('ssrfGuard.createGuardedLookup', () => {
  const lookup = (hostname, options = {}) =>
    new Promise((resolve, reject) => {
      createGuardedLookup()(hostname, options, (error, ...result) => (error ? reject(error) : resolve(result)));
    });

  it('refuses to connect to a name that resolves to a private address', async () => {
    await expect(lookup('localhost')).rejects.toBeInstanceOf(BlockedHostError);
  });

  it('honours a custom predicate and both lookup result shapes', async () => {
    const allowAll = createGuardedLookup(() => false);
    const single = await new Promise((resolve) => allowAll('localhost', {}, (_, address) => resolve(address)));
    const all = await new Promise((resolve) =>
      allowAll('localhost', { all: true }, (_, addresses) => resolve(addresses)),
    );

    expect(typeof single).toBe('string');
    expect(Array.isArray(all) && all.length > 0).toBe(true);
  });

  it('reports DNS failures as errors', async () => {
    await expect(lookup('does-not-exist.invalid')).rejects.toThrow();
  });
});

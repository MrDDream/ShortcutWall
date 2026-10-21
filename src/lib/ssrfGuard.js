const dns = require('dns');
const net = require('net');

// Blocks loopback, private, link-local, and other non-public IP ranges so that
// admin-supplied URLs (site creation, favicon fetch) cannot be used to reach
// internal services or cloud metadata endpoints (SSRF).
const blockList = new net.BlockList();

const IPV4_BLOCKED_SUBNETS = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (incl. cloud metadata, e.g. 169.254.169.254)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation (TEST-NET-1)
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation (TEST-NET-2)
  ['203.0.113.0', 24], // documentation (TEST-NET-3)
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved
  ['255.255.255.255', 32], // broadcast
];

const IPV6_BLOCKED_SUBNETS = [
  ['::1', 128], // loopback
  ['::', 128], // unspecified
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['64:ff9b::', 96], // NAT64: would reach any IPv4 address, private ones included
  ['2002::', 16], // 6to4: embeds an arbitrary IPv4 address
];

for (const [subnet, prefix] of IPV4_BLOCKED_SUBNETS) {
  blockList.addSubnet(subnet, prefix, 'ipv4');
}
for (const [subnet, prefix] of IPV6_BLOCKED_SUBNETS) {
  blockList.addSubnet(subnet, prefix, 'ipv6');
}

class BlockedHostError extends Error {}

// IPv4-mapped IPv6 literals (::ffff:a.b.c.d) are unwrapped and checked as
// plain IPv4 against the rules above. Deliberately not done by adding an
// "::ffff:0:0/96" subnet to the BlockList: Node's BlockList.check() matches
// that rule against *every* plain IPv4 address too (it normalises IPv4
// lookups through their mapped form), which would block all public IPv4
// hosts outright.
function toCheckableAddress(address, family) {
  if (family === 6 && address.toLowerCase().startsWith('::ffff:')) {
    const mapped = address.slice(7);
    if (net.isIPv4(mapped)) {
      return { address: mapped, type: 'ipv4' };
    }
  }
  return { address, type: family === 6 ? 'ipv6' : 'ipv4' };
}

function isBlockedAddress(address, family) {
  const checkable = toCheckableAddress(address, family);
  return blockList.check(checkable.address, checkable.type);
}

// Builds a drop-in replacement for dns.lookup, given to the HTTP client's
// sockets: the address is checked at the moment the connection is made, for
// every hop of a redirect chain. Checking there rather than before the request
// also closes the DNS-rebinding window (a name re-resolving to a private
// address between the check and the connection). `isBlocked` is swappable for
// tests only.
function createGuardedLookup(isBlocked = isBlockedAddress) {
  return function guardedLookup(hostname, options, callback) {
    const lookupOptions = typeof options === 'object' && options !== null ? options : {};
    dns.lookup(hostname, { ...lookupOptions, all: true, verbatim: true }, (error, addresses) => {
      if (error) {
        return callback(error);
      }
      const blocked = addresses.find(({ address, family }) => isBlocked(address, family));
      if (blocked || !addresses.length) {
        return callback(new BlockedHostError(`Blocked non-public address: ${blocked?.address ?? hostname}`));
      }
      if (lookupOptions.all) {
        return callback(null, addresses);
      }
      return callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

module.exports = { isBlockedAddress, createGuardedLookup, BlockedHostError };

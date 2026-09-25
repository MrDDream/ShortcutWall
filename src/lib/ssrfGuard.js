const dns = require('dns').promises;
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
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved
  ['255.255.255.255', 32], // broadcast
];

const IPV6_BLOCKED_SUBNETS = [
  ['::1', 128], // loopback
  ['::', 128], // unspecified
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
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

// Resolves the URL's hostname and rejects it if any resolved address falls in
// a non-public range. Note: this is a resolve-then-check guard, not full IP
// pinning, so it does not fully eliminate DNS-rebinding races between the
// check and the subsequent fetch — an acceptable, standard baseline mitigation
// for this class of app, not a substitute for network-level egress controls.
async function assertPublicHost(targetUrl) {
  const { hostname } = new URL(targetUrl);

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new BlockedHostError('DNS resolution failed.');
  }

  if (!addresses.length) {
    throw new BlockedHostError('DNS resolution returned no address.');
  }

  for (const { address, family } of addresses) {
    const checkable = toCheckableAddress(address, family);
    if (blockList.check(checkable.address, checkable.type)) {
      throw new BlockedHostError(`Blocked non-public address: ${address}`);
    }
  }
}

module.exports = { assertPublicHost, BlockedHostError };

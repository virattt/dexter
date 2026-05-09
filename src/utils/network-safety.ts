import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const PRIVATE_NETWORK_ALLOWED = process.env.DEXTER_ALLOW_PRIVATE_NETWORK === 'true';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'host.docker.internal',
  'gateway.docker.internal',
  'metadata.google.internal',
  'metadata',
]);

function parseIpv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => {
    if (!/^\d+$/.test(part)) return Number.NaN;
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : Number.NaN;
  });

  return octets.every((value) => Number.isInteger(value)) ? octets : null;
}

function isBlockedIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return false;

  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  const mappedIpv4 = normalized.match(/^(?:::ffff:|0:0:0:0:0:ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4?.[1]) {
    return isBlockedIpv4(mappedIpv4[1]);
  }

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:0' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff')
  );
}

function isBlockedIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return false;
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '');
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return BLOCKED_HOSTNAMES.has(normalized) || normalized.endsWith('.localhost');
}

export async function assertSafeRemoteHttpUrl(input: string | URL): Promise<URL> {
  const parsed = typeof input === 'string' ? new URL(input) : input;

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL must use http or https');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URL credentials are not allowed');
  }

  if (PRIVATE_NETWORK_ALLOWED) {
    return parsed;
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (isBlockedHostname(hostname) || isBlockedIp(hostname)) {
    throw new Error(`Blocked private or local URL host: ${parsed.hostname}`);
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  for (const address of addresses) {
    if (isBlockedIp(address.address)) {
      throw new Error(`Blocked private or local resolved address for ${parsed.hostname}`);
    }
  }

  return parsed;
}

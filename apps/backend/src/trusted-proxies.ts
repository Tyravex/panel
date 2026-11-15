import { isIP } from 'node:net';

/** Only explicitly configured proxy addresses may assert HTTPS forwarding headers. */
export function getTrustedProxyAddresses(value = process.env.TRUSTED_PROXY_IPS): string[] {
  if (!value?.trim()) return [];
  const addresses = value.split(',').map((entry) => entry.trim());
  if (addresses.some((entry) => !isIP(entry))) throw new Error('TRUSTED_PROXY_IPS must contain explicit proxy IP addresses');
  return [...new Set(addresses)];
}

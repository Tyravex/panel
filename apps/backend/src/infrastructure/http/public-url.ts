import { isIP } from 'node:net';

/**
 * Fail-closed IPv4 policy.
 * IPv6 is deliberately unsupported for community registry connections.
 */
export function isPublicRegistryIp(ip: string): boolean {
    if (isIP(ip) !== 4) return false;

    const octets = ip.split('.').map(Number);
    const [a, b, c] = octets;

    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;

    // IETF protocol assignments and documentation ranges.
    if (a === 192 && b === 0 && c === 0) return false;
    if (a === 192 && b === 0 && c === 2) return false;
    if (a === 192 && b === 88 && c === 99) return false;
    if (a === 198 && b >= 18 && b <= 19) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;

    // Additional special-purpose address blocks.
    if (a === 192 && b === 31 && c === 196) return false;
    if (a === 192 && b === 52 && c === 193) return false;
    if (a === 192 && b === 175 && c === 48) return false;

    return true;
}

export function isSafeCommunityHttpsUrl(value: string): boolean {
    try {
        const url = new URL(value);

        if (
            url.protocol !== 'https:' ||
            url.username ||
            url.password ||
            url.port ||
            url.search ||
            url.hash ||
            !url.hostname.includes('.') ||
            isIP(url.hostname) !== 0
        ) {
            return false;
        }

        const hostname = url.hostname.toLowerCase();

        return !(
            hostname === 'localhost' ||
            hostname.endsWith('.localhost') ||
            hostname.endsWith('.local') ||
            hostname.endsWith('.internal') ||
            hostname.endsWith('.test') ||
            hostname.endsWith('.invalid') ||
            hostname.endsWith('.example')
        );
    } catch {
        return false;
    }
}

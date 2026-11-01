import { isIP } from 'node:net';

import type {
    MarketplacePlugin,
    MarketplaceRegistry,
} from '@shared/types';

const MAX_PLUGINS = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value);
}

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

export function parseCommunityRegistry(
    value: unknown,
): MarketplaceRegistry {
    if (
        !isRecord(value) ||
        value.schemaVersion !== 1 ||
        !Array.isArray(value.plugins) ||
        value.plugins.length > MAX_PLUGINS
    ) {
        throw new Error('Invalid registry schema');
    }

    const ids = new Set<string>();
    const plugins: MarketplacePlugin[] = [];

    for (const entry of value.plugins) {
        if (!isRecord(entry)) {
            throw new Error('Invalid plugin entry');
        }

        const keys = [
            'id',
            'name',
            'description',
            'type',
            'version',
            'downloadUrl',
            'sha256',
        ] as const;

        if (
            keys.some(
                (key) =>
                    typeof entry[key] !== 'string' ||
                    !(entry[key] as string).trim(),
            )
        ) {
            throw new Error('Missing plugin fields');
        }

        const plugin = {
            id: entry.id as string,
            name: entry.name as string,
            description: entry.description as string,
            type: entry.type as string,
            version: entry.version as string,
            downloadUrl: entry.downloadUrl as string,
            sha256: entry.sha256 as string,
        };

        if (
            !/^[a-f0-9]{64}$/i.test(plugin.sha256) ||
            !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(
                plugin.version,
            ) ||
            !isSafeCommunityHttpsUrl(plugin.downloadUrl) ||
            ids.has(plugin.id)
        ) {
            throw new Error('Invalid plugin entry');
        }

        ids.add(plugin.id);
        plugins.push(plugin as MarketplacePlugin);
    }

    return {
        schemaVersion: 1,
        plugins,
    };
}
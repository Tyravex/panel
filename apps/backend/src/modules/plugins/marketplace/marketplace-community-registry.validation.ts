import { isSafeCommunityHttpsUrl } from '@/infrastructure/http/public-url';
export { isPublicRegistryIp, isSafeCommunityHttpsUrl } from '@/infrastructure/http/public-url';

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
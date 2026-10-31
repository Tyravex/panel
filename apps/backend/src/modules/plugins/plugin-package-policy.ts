import { posix } from 'node:path';

export const PLUGIN_PACKAGE_LIMITS = {
    maxArchiveBytes: 20 * 1024 * 1024,
    maxExtractedBytes: 50 * 1024 * 1024,
    maxFiles: 500,
    maxFileBytes: 5 * 1024 * 1024,
    maxPathLength: 240,
    maxPathDepth: 12,
} as const;

const DRIVE_PREFIX = /^[a-zA-Z]:/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export interface PluginPackageEntry {
    path: string;
    size: number;
    kind: 'file' | 'directory' | 'symlink' | 'other';
}

export interface ValidatedPluginPackage {
    entries: PluginPackageEntry[];
    totalExtractedBytes: number;
}

export const validatePluginPackagePath = (
    path: string,
): string => {
    if (
        typeof path !== 'string' ||
        path.length === 0 ||
        path.length > PLUGIN_PACKAGE_LIMITS.maxPathLength ||
        CONTROL_CHARACTERS.test(path) ||
        path.includes('\\') ||
        path.startsWith('/') ||
        DRIVE_PREFIX.test(path)
    ) {
        throw new Error('Invalid plugin package path.');
    }

    const normalized = path.endsWith('/')
        ? path.slice(0, -1)
        : path;

    const segments = normalized.split('/');

    if (
        segments.length > PLUGIN_PACKAGE_LIMITS.maxPathDepth ||
        segments.some(
            (segment) =>
                segment === '' ||
                segment === '.' ||
                segment === '..' ||
                segment.endsWith('.') ||
                segment.endsWith(' ') ||
                segment.includes(':'),
        )
    ) {
        throw new Error('Unsafe plugin package path.');
    }

    if (posix.normalize(normalized) !== normalized) {
        throw new Error('Non-canonical plugin package path.');
    }

    return normalized;
};

export const validatePluginPackageEntries = (
    entries: readonly PluginPackageEntry[],
): ValidatedPluginPackage => {
    if (
        entries.length === 0 ||
        entries.length > PLUGIN_PACKAGE_LIMITS.maxFiles
    ) {
        throw new Error('Invalid plugin package entry count.');
    }

    const paths = new Set<string>();
    const filePaths = new Set<string>();
    let totalExtractedBytes = 0;
    let manifestCount = 0;

    for (const entry of entries) {
        if (
            entry.kind !== 'file' &&
            entry.kind !== 'directory'
        ) {
            throw new Error(
                'Plugin package contains an unsupported entry type.',
            );
        }

        const path = validatePluginPackagePath(entry.path);
        const collisionKey = path.toLowerCase();

        if (paths.has(collisionKey)) {
            throw new Error('Duplicate plugin package path.');
        }

        paths.add(collisionKey);

        if (
            !Number.isSafeInteger(entry.size) ||
            entry.size < 0
        ) {
            throw new Error('Invalid plugin package entry size.');
        }

        if (entry.kind === 'directory') {
            if (entry.size !== 0) {
                throw new Error('Invalid directory entry size.');
            }
            continue;
        }

        if (entry.size > PLUGIN_PACKAGE_LIMITS.maxFileBytes) {
            throw new Error('Plugin package file exceeds size limit.');
        }

        filePaths.add(collisionKey);

        totalExtractedBytes += entry.size;

        if (
            totalExtractedBytes >
            PLUGIN_PACKAGE_LIMITS.maxExtractedBytes
        ) {
            throw new Error(
                'Plugin package exceeds extracted size limit.',
            );
        }

        if (path === 'manifest.json') {
            manifestCount += 1;
        }
    }

    if (manifestCount !== 1) {
        throw new Error(
            'Plugin package must contain one root manifest.json.',
        );
    }

    for (const path of paths) {
        const segments = path.split('/');

        for (let index = 1; index < segments.length; index += 1) {
            const parent = segments.slice(0, index).join('/');

            if (filePaths.has(parent)) {
                throw new Error(
                    'Plugin package path conflicts with a file.',
                );
            }
        }
    }

    return {
        entries: [...entries],
        totalExtractedBytes,
    };
};

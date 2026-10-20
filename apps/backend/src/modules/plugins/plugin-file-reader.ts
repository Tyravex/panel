import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';

import { getPluginStorageRoot } from './plugin-storage.config';
import { resolvePluginStoragePath } from './plugin-storage-path';

const MAX_PLUGIN_FILE_BYTES = 1024 * 1024;

const isInsideDirectory = (
    directory: string,
    target: string,
): boolean => {
    const path = relative(directory, target);

    return (
        path !== '' &&
        path !== '..' &&
        !path.startsWith(`..${sep}`) &&
        !isAbsolute(path)
    );
};

/**
 * Reads a regular file from the managed plugin storage.
 *
 * The file must:
 * - stay inside the configured storage directory;
 * - not be accessible through symbolic links;
 * - be smaller than the configured size limit.
 *
 * Plugin packages must still be validated before installation.
 */
export const readPluginFile = async (
    relativePath: string,
    maxBytes = MAX_PLUGIN_FILE_BYTES,
): Promise<Buffer> => {
    if (
        !Number.isSafeInteger(maxBytes) ||
        maxBytes <= 0 ||
        maxBytes > MAX_PLUGIN_FILE_BYTES
    ) {
        throw new Error('Invalid plugin file size limit.');
    }

    const storageRoot = getPluginStorageRoot();
    const filePath = resolvePluginStoragePath(relativePath);

    const rootStats = await lstat(storageRoot);

    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
        throw new Error(
            'Plugin storage root must be a regular directory.',
        );
    }

    const realRoot = await realpath(storageRoot);
    const realFilePath = await realpath(filePath);

    if (!isInsideDirectory(realRoot, realFilePath)) {
        throw new Error('Plugin file is outside storage root.');
    }

    // Reject symbolic links in every path component.
    const segments = relative(storageRoot, filePath)
        .split(sep)
        .filter(Boolean);

    let currentPath = storageRoot;

    for (const segment of segments) {
        currentPath = `${currentPath}${sep}${segment}`;

        const stats = await lstat(currentPath);

        if (stats.isSymbolicLink()) {
            throw new Error('Symbolic links are not allowed in plugin paths.');
        }
    }

    // O_NOFOLLOW prevents following a symbolic link at the final path.
    const handle = await open(
        filePath,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );

    try {
        const stats = await handle.stat();

        if (!stats.isFile()) {
            throw new Error('Plugin resource is not a regular file.');
        }

        if (stats.size > maxBytes) {
            throw new Error('Plugin resource exceeds the size limit.');
        }

        const buffer = Buffer.alloc(stats.size);

        let bytesRead = 0;

        while (bytesRead < buffer.length) {
            const result = await handle.read(
                buffer,
                bytesRead,
                buffer.length - bytesRead,
                bytesRead,
            );

            if (result.bytesRead === 0) {
                throw new Error('Plugin resource ended unexpectedly.');
            }

            bytesRead += result.bytesRead;
        }

        return buffer;
    } finally {
        await handle.close();
    }
};

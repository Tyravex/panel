import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { constants } from 'node:fs';
import {
    lstat,
    mkdir,
    mkdtemp,
    open,
    realpath,
    rm,
} from 'node:fs/promises';
import { join, resolve, sep, parse } from 'node:path';
import * as yauzl from 'yauzl';

import {
    PLUGIN_PACKAGE_LIMITS,
    validatePluginPackagePath,
} from './plugin-package-policy';
import {
    inspectPluginZip,
    type InspectedPluginZip,
} from './plugin-zip-reader';
import {
    getPluginStorageRoot,
} from './plugin-storage.config';

const CRC_TABLE = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1
            ? 0xedb88320 ^ (value >>> 1)
            : value >>> 1;
    }

    CRC_TABLE[index] = value >>> 0;
}

const updateCrc = (
    previous: number,
    chunk: Buffer,
): number => {
    let crc = previous;

    for (const byte of chunk) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^
            (crc >>> 8);
    }

    return crc >>> 0;
};

export interface StagedPluginPackage {
    stagingPath: string;
    inspection: InspectedPluginZip;
}

const ensureStorageRoot = async (): Promise<string> => {
    const root = getPluginStorageRoot();

    await mkdir(root, { recursive: true });

    const absoluteRoot = resolve(root);
    const parsed = parse(absoluteRoot);

    const segments = absoluteRoot
        .slice(parsed.root.length)
        .split(sep)
        .filter(Boolean);

    let current = parsed.root;

    for (const segment of segments) {
        current = join(current, segment);

        const stats = await lstat(current);

        if (!stats.isDirectory() || stats.isSymbolicLink()) {
            throw new Error(
                'Plugin storage path must contain only regular directories.',
            );
        }
    }

    return absoluteRoot;
};

const openArchive = (
    buffer: Buffer,
): Promise<yauzl.ZipFile> =>
    new Promise((resolvePromise, reject) => {
        yauzl.fromBuffer(
            buffer,
            {
                lazyEntries: true,
                autoClose: false,
                decodeStrings: true,
                validateEntrySizes: true,
                strictFileNames: true,
            },
            (error, zipFile) => {
                if (error || !zipFile) {
                    reject(new Error('Cannot open plugin ZIP.'));
                    return;
                }

                resolvePromise(zipFile);
            },
        );
    });

const collectEntries = (
    zipFile: yauzl.ZipFile,
): Promise<yauzl.Entry[]> =>
    new Promise((resolvePromise, reject) => {
        const entries: yauzl.Entry[] = [];
        let settled = false;

        const fail = () => {
            if (settled) return;
            settled = true;
            reject(new Error('Cannot enumerate plugin ZIP.'));
        };

        zipFile.on('error', fail);

        zipFile.on('entry', (entry: yauzl.Entry) => {
            if (settled) return;

            entries.push(entry);

            if (
                entries.length >
                PLUGIN_PACKAGE_LIMITS.maxFiles
            ) {
                fail();
                return;
            }

            zipFile.readEntry();
        });

        zipFile.on('end', () => {
            if (settled) return;
            settled = true;
            resolvePromise(entries);
        });

        zipFile.readEntry();
    });

const getEntryStream = (
    zipFile: yauzl.ZipFile,
    entry: yauzl.Entry,
): Promise<Readable> =>
    new Promise((resolvePromise, reject) => {
        zipFile.openReadStream(
            entry,
            (error, stream) => {
                if (error || !stream) {
                    reject(new Error('Cannot read plugin entry.'));
                    return;
                }

                resolvePromise(stream);
            },
        );
    });

const writeEntry = async (
    zipFile: yauzl.ZipFile,
    entry: yauzl.Entry,
    destination: string,
    onBytes: (bytes: number) => void,
): Promise<void> => {
    const stream = await getEntryStream(
        zipFile,
        entry,
    );

    const handle = await open(
        destination,
        constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        (constants.O_NOFOLLOW ?? 0),
        0o600,
    );

    let bytesWritten = 0;
    let crc = 0xffffffff;

    try {
        for await (const chunk of stream) {
            const data = Buffer.isBuffer(chunk)
                ? chunk
                : Buffer.from(chunk as Uint8Array);

            bytesWritten += data.length;

            if (
                bytesWritten > entry.uncompressedSize ||
                bytesWritten >
                PLUGIN_PACKAGE_LIMITS.maxFileBytes
            ) {
                throw new Error(
                    'Plugin entry exceeds the size limit.',
                );
            }

            onBytes(data.length);
            crc = updateCrc(crc, data);

            let offset = 0;

            while (offset < data.length) {
                const result = await handle.write(
                    data,
                    offset,
                    data.length - offset,
                );

                if (result.bytesWritten <= 0) {
                    throw new Error(
                        'Failed to write plugin entry.',
                    );
                }

                offset += result.bytesWritten;
            }
        }

        const finalCrc =
            (crc ^ 0xffffffff) >>> 0;

        if (
            bytesWritten !== entry.uncompressedSize ||
            finalCrc !== (entry.crc32 >>> 0)
        ) {
            throw new Error(
                'Plugin entry integrity check failed.',
            );
        }

        await handle.sync();
    } finally {
        stream.destroy();
        await handle.close();
    }
};

/**
 * Creates a private, disposable staging directory.
 *
 * No database records are created.
 * No files are published as installed plugins.
 */
export const stagePluginPackage = async (
    archive: Buffer,
): Promise<StagedPluginPackage> => {
    // Validate the complete archive before touching disk.
    const inspection = await inspectPluginZip(
        archive,
    );

    const root = await ensureStorageRoot();

    const stagingPath = await mkdtemp(
        join(root, `.staging-${randomUUID()}-`),
    );

    let zipFile: yauzl.ZipFile | undefined;

    try {
        zipFile = await openArchive(archive);

        const entries = await collectEntries(zipFile);

        const expected = new Map(
            inspection.entries.map((entry) => [
                entry.path,
                entry,
            ]),
        );

        if (entries.length !== expected.size) {
            throw new Error(
                'ZIP entry count changed after inspection.',
            );
        }

        let totalWritten = 0;

        const onBytes = (bytes: number) => {
            totalWritten += bytes;

            if (
                totalWritten >
                PLUGIN_PACKAGE_LIMITS.maxExtractedBytes
            ) {
                throw new Error(
                    'Plugin package exceeds extraction limit.',
                );
            }
        };

        for (const entry of entries) {
            const relativePath =
                validatePluginPackagePath(entry.fileName);

            const expectedEntry = expected.get(
                entry.fileName,
            );

            const isDirectory =
                entry.fileName.endsWith('/');

            if (
                !expectedEntry ||
                expectedEntry.size !==
                entry.uncompressedSize ||
                expectedEntry.kind !==
                (isDirectory ? 'directory' : 'file')
            ) {
                throw new Error(
                    'ZIP metadata changed after inspection.',
                );
            }

            const segments = relativePath
                .replace(/\/$/, '')
                .split('/');

            const destination = join(
                stagingPath,
                ...segments,
            );

            const relativeDestination =
                destination.slice(stagingPath.length);

            if (
                !relativeDestination.startsWith(sep) ||
                relativeDestination === sep
            ) {
                throw new Error(
                    'Invalid plugin destination.',
                );
            }

            if (isDirectory) {
                await mkdir(destination, {
                    recursive: true,
                    mode: 0o700,
                });

                continue;
            }

            const parent = join(
                stagingPath,
                ...segments.slice(0, -1),
            );

            await mkdir(parent, {
                recursive: true,
                mode: 0o700,
            });

            await writeEntry(
                zipFile,
                entry,
                destination,
                onBytes,
            );
        }

        if (
            totalWritten !==
            inspection.totalExtractedBytes
        ) {
            throw new Error(
                'Plugin extraction size mismatch.',
            );
        }

        return {
            stagingPath,
            inspection,
        };
    } catch (error) {
        await rm(stagingPath, {
            recursive: true,
            force: true,
        });

        throw error;
    } finally {
        zipFile?.close();
    }
};

/**
 * Discards a staged package.
 *
 * Only paths created by stagePluginPackage
 * should be passed to this function.
 */
export const discardStagedPluginPackage = async (
    staged: StagedPluginPackage,
): Promise<void> => {
    const root = getPluginStorageRoot();
    const parent = resolve(
        staged.stagingPath,
        '..',
    );

    const name = staged.stagingPath
        .slice(parent.length + 1);

    if (
        parent !== root ||
        !/^\.staging-[0-9a-f-]{36}-[a-zA-Z0-9]+$/.test(
            name,
        )
    ) {
        throw new Error(
            'Invalid plugin staging directory.',
        );
    }

    const stats = await lstat(
        staged.stagingPath,
    ).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
            return null;
        }

        throw error;
    });

    if (!stats) return;

    if (
        !stats.isDirectory() ||
        stats.isSymbolicLink()
    ) {
        throw new Error(
            'Plugin staging path is not a directory.',
        );
    }

    await rm(staged.stagingPath, {
        recursive: true,
        force: true,
    });
};

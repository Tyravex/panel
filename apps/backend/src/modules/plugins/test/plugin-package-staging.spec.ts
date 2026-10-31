import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
    lstat,
    mkdtemp,
    readFile,
    rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';

import {
    discardStagedPluginPackage,
    stagePluginPackage,
} from '../plugin-package-staging';
import {
    PLUGIN_STORAGE_ENV_KEY,
} from '../plugin-storage.config';

const CRC_TABLE = new Uint32Array(256);

for (let i = 0; i < 256; i += 1) {
    let value = i;

    for (let j = 0; j < 8; j += 1) {
        value = value & 1
            ? 0xedb88320 ^ (value >>> 1)
            : value >>> 1;
    }

    CRC_TABLE[i] = value >>> 0;
}

const crc32 = (data: Buffer): number => {
    let crc = 0xffffffff;

    for (const byte of data) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^
            (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
};

interface TestEntry {
    name: string;
    data: Buffer;
}

const makeZip = (
    entries: TestEntry[],
): Buffer => {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];

    let offset = 0;

    for (const entry of entries) {
        const name = Buffer.from(
            entry.name,
            'utf8',
        );

        const compressed = deflateRawSync(
            entry.data,
        );

        const checksum = crc32(entry.data);

        const local = Buffer.alloc(30);

        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(8, 8);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(
            compressed.length,
            18,
        );
        local.writeUInt32LE(
            entry.data.length,
            22,
        );
        local.writeUInt16LE(name.length, 26);

        localParts.push(
            local,
            name,
            compressed,
        );

        const central = Buffer.alloc(46);

        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(0x0314, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(
            compressed.length,
            20,
        );
        central.writeUInt32LE(
            entry.data.length,
            24,
        );
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(
            0x81a40000,
            38,
        );
        central.writeUInt32LE(offset, 42);

        centralParts.push(central, name);

        offset +=
            local.length +
            name.length +
            compressed.length;
    }

    const centralDirectory =
        Buffer.concat(centralParts);

    const end = Buffer.alloc(22);

    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(
        centralDirectory.length,
        12,
    );
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([
        ...localParts,
        centralDirectory,
        end,
    ]);
};

const makeValidPackage = (): Buffer => {
    const manifest = {
        schemaVersion: 1,
        id: 'example.language',
        type: 'language',
        version: '1.0.0',
        language: {
            code: 'fr',
            name: 'French',
            nativeName: 'Français',
        },
        translations: {
            namespace: 'translation',
            path: './translations/fr.json',
        },
    };

    return makeZip([
        {
            name: 'manifest.json',
            data: Buffer.from(
                JSON.stringify(manifest),
            ),
        },
        {
            name: 'translations/fr.json',
            data: Buffer.from(
                JSON.stringify({
                    welcome: 'Bonjour',
                }),
            ),
        },
    ]);
};

describe('Plugin package staging', () => {
    let temporaryRoot: string;
    let previousStorage: string | undefined;

    beforeEach(async () => {
        previousStorage =
            process.env[PLUGIN_STORAGE_ENV_KEY];

        temporaryRoot = await mkdtemp(
            join(tmpdir(), `tyravex-${randomUUID()}-`),
        );

        process.env[PLUGIN_STORAGE_ENV_KEY] =
            join(temporaryRoot, 'plugins');
    });

    afterEach(async () => {
        if (previousStorage === undefined) {
            delete process.env[PLUGIN_STORAGE_ENV_KEY];
        } else {
            process.env[PLUGIN_STORAGE_ENV_KEY] =
                previousStorage;
        }

        await rm(temporaryRoot, {
            recursive: true,
            force: true,
        });
    });

    it('stages a valid language plugin', async () => {
        const staged = await stagePluginPackage(
            makeValidPackage(),
        );

        expect(staged.inspection.manifest.id).toBe(
            'example.language',
        );

        const manifestBytes = await readFile(
            join(staged.stagingPath, 'manifest.json'),
        );

        const manifest = JSON.parse(
            manifestBytes.toString('utf8'),
        ) as { id: string };

        expect(manifest.id).toBe(
            'example.language',
        );

        const translationBytes = await readFile(
            join(
                staged.stagingPath,
                'translations',
                'fr.json',
            ),
        );

        expect(
            JSON.parse(
                translationBytes.toString('utf8'),
            ),
        ).toEqual({
            welcome: 'Bonjour',
        });

        await discardStagedPluginPackage(staged);

        await expect(
            lstat(staged.stagingPath),
        ).rejects.toMatchObject({
            code: 'ENOENT',
        });
    });

    it('rejects invalid archives', async () => {
        await expect(
            stagePluginPackage(
                Buffer.from('not-a-zip'),
            ),
        ).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });

    it('rejects a forged cleanup path', async () => {
        await expect(
            discardStagedPluginPackage({
                stagingPath: temporaryRoot,
                inspection: {
                    manifest: {
                        schemaVersion: 1,
                        id: 'example.language',
                        type: 'language',
                        version: '1.0.0',
                        language: {
                            code: 'fr',
                            name: 'French',
                            nativeName: 'Français',
                        },
                        translations: {
                            namespace: 'translation',
                            path: './translations/fr.json',
                        },
                    },
                    entries: [],
                    totalExtractedBytes: 0,
                },
            }),
        ).rejects.toThrow(
            'Invalid plugin staging directory.',
        );
    });
});

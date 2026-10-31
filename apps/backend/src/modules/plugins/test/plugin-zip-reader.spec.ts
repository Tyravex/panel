import { BadRequestException } from '@nestjs/common';

import {
    inspectPluginZip,
} from '../plugin-zip-reader';
import {
    PLUGIN_PACKAGE_LIMITS,
} from '../plugin-package-policy';

interface TestZipEntry {
    name: string;
    data: Buffer;
    externalAttributes?: number;
}

const crcTable = new Uint32Array(256);

for (let i = 0; i < 256; i += 1) {
    let value = i;

    for (let j = 0; j < 8; j += 1) {
        value = value & 1
            ? 0xedb88320 ^ (value >>> 1)
            : value >>> 1;
    }

    crcTable[i] = value >>> 0;
}

const crc32 = (data: Buffer): number => {
    let crc = 0xffffffff;

    for (const byte of data) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
};

const makeZip = (entries: TestZipEntry[]): Buffer => {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];

    let offset = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8');
        const checksum = crc32(entry.data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(0, 8);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(entry.data.length, 18);
        local.writeUInt32LE(entry.data.length, 22);
        local.writeUInt16LE(name.length, 26);

        localParts.push(local, name, entry.data);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(0x0314, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(entry.data.length, 20);
        central.writeUInt32LE(entry.data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(
            entry.externalAttributes ?? (0x81a40000 >>> 0),
            38,
        );
        central.writeUInt32LE(offset, 42);

        centralParts.push(central, name);

        offset += local.length + name.length + entry.data.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);

    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([
        ...localParts,
        centralDirectory,
        end,
    ]);
};

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

const makeValidEntries = (): TestZipEntry[] => [
    {
        name: 'manifest.json',
        data: Buffer.from(JSON.stringify(manifest)),
    },
    {
        name: 'translations/fr.json',
        data: Buffer.from(
            JSON.stringify({
                welcome: 'Bonjour',
                navigation: {
                    home: 'Accueil',
                },
            }),
        ),
    },
];

describe('Plugin ZIP reader', () => {
    it('accepts a valid ZIP package', async () => {
        const result = await inspectPluginZip(
            makeZip(makeValidEntries()),
        );

        expect(result.manifest.id).toBe('example.language');
        expect(result.manifest.language.code).toBe('fr');
        expect(result.entries).toHaveLength(2);
        expect(result.totalExtractedBytes).toBeGreaterThan(0);
    });

    it('rejects an empty buffer', async () => {
        await expect(
            inspectPluginZip(Buffer.alloc(0)),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects non-ZIP data', async () => {
        await expect(
            inspectPluginZip(Buffer.from('not a zip file')),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects oversized archives', async () => {
        await expect(
            inspectPluginZip(
                Buffer.alloc(
                    PLUGIN_PACKAGE_LIMITS.maxArchiveBytes + 1,
                ),
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a truncated ZIP header', async () => {
        await expect(
            inspectPluginZip(
                Buffer.from([0x50, 0x4b, 0x03, 0x04]),
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects path traversal', async () => {
        const entries = makeValidEntries();

        entries.push({
            name: '../outside.txt',
            data: Buffer.from('unsafe'),
        });

        await expect(
            inspectPluginZip(makeZip(entries)),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects duplicate paths', async () => {
        const entries = makeValidEntries();

        entries.push({
            name: 'MANIFEST.JSON',
            data: Buffer.from('{}'),
        });

        await expect(
            inspectPluginZip(makeZip(entries)),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects symbolic links', async () => {
        const entries = makeValidEntries();

        entries.push({
            name: 'link',
            data: Buffer.from('target'),
            externalAttributes: 0xa1ff0000 >>> 0,
        });

        await expect(
            inspectPluginZip(makeZip(entries)),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects invalid translation data', async () => {
        const entries = makeValidEntries();

        entries[1] = {
            name: 'translations/fr.json',
            data: Buffer.from(
                JSON.stringify({
                    welcome: 123,
                }),
            ),
        };

        await expect(
            inspectPluginZip(makeZip(entries)),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects invalid translation JSON', async () => {
        const entries = makeValidEntries();

        entries[1] = {
            name: 'translations/fr.json',
            data: Buffer.from('{invalid'),
        };

        await expect(
            inspectPluginZip(makeZip(entries)),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects invalid UTF-8', async () => {
        const entries = makeValidEntries();

        entries[1] = {
            name: 'translations/fr.json',
            data: Buffer.from([0xff, 0xfe, 0xfd]),
        };

        await expect(
            inspectPluginZip(makeZip(entries)),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a corrupted file checksum', async () => {
        const zip = makeZip(makeValidEntries());

        // Corrupt one byte of the manifest payload without
        // updating the ZIP checksum.
        const manifestOffset =
            30 + Buffer.byteLength('manifest.json');

        zip[manifestOffset] ^= 0x01;

        await expect(
            inspectPluginZip(zip),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects packages without a manifest', async () => {
        await expect(
            inspectPluginZip(
                makeZip([
                    {
                        name: 'translations/fr.json',
                        data: Buffer.from('{}'),
                    },
                ]),
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
    });
});

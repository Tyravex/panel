import { BadRequestException } from '@nestjs/common';
import { deflateRawSync } from 'node:zlib';

import { inspectPluginZip } from '../plugin-zip-reader';

interface EntryInput {
    name: string;
    data: Buffer;
    method?: 0 | 8;
}

const crcTable = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1
            ? 0xedb88320 ^ (value >>> 1)
            : value >>> 1;
    }

    crcTable[index] = value >>> 0;
}

const crc32 = (data: Buffer): number => {
    let crc = 0xffffffff;

    for (const byte of data) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
};

const makeZip = (entries: EntryInput[]): Buffer => {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];

    let offset = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8');
        const method = entry.method ?? 8;
        const payload = method === 8
            ? deflateRawSync(entry.data)
            : entry.data;
        const checksum = crc32(entry.data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(method, 8);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(payload.length, 18);
        local.writeUInt32LE(entry.data.length, 22);
        local.writeUInt16LE(name.length, 26);

        localParts.push(local, name, payload);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(0x0314, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(method, 10);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(payload.length, 20);
        central.writeUInt32LE(entry.data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(0x81a40000, 38);
        central.writeUInt32LE(offset, 42);

        centralParts.push(central, name);

        offset += local.length + name.length + payload.length;
    }

    const directory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);

    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([
        ...localParts,
        directory,
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

const validEntries = (): EntryInput[] => [
    {
        name: 'manifest.json',
        data: Buffer.from(JSON.stringify(manifest)),
    },
    {
        name: 'translations/fr.json',
        data: Buffer.from(
            JSON.stringify({ welcome: 'Bonjour' }),
        ),
    },
];

describe('Plugin ZIP header and DEFLATE validation', () => {
    it('accepts a valid DEFLATE archive', async () => {
        const result = await inspectPluginZip(
            makeZip(validEntries()),
        );

        expect(result.manifest.id).toBe('example.language');
        expect(result.entries).toHaveLength(2);
    });

    it('accepts a valid STORE archive', async () => {
        const entries = validEntries().map((entry) => ({
            ...entry,
            method: 0 as const,
        }));

        const result = await inspectPluginZip(makeZip(entries));

        expect(result.manifest.language.code).toBe('fr');
    });

    it('rejects mismatched compression methods', async () => {
        const zip = makeZip(validEntries());

        // Change the local header only.
        zip.writeUInt16LE(0, 8);

        await expect(
            inspectPluginZip(zip),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects mismatched local CRC32', async () => {
        const zip = makeZip(validEntries());

        zip.writeUInt32LE(0, 14);

        await expect(
            inspectPluginZip(zip),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects mismatched uncompressed sizes', async () => {
        const zip = makeZip(validEntries());

        zip.writeUInt32LE(1, 22);

        await expect(
            inspectPluginZip(zip),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects mismatched local file names', async () => {
        const zip = makeZip(validEntries());

        // First byte of the first local file name.
        zip[30] = 'x'.charCodeAt(0);

        await expect(
            inspectPluginZip(zip),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a damaged local header signature', async () => {
        const zip = makeZip(validEntries());

        zip.writeUInt32LE(0, 0);

        await expect(
            inspectPluginZip(zip),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects corrupted DEFLATE payloads', async () => {
        const zip = makeZip(validEntries());

        const dataOffset =
            30 + Buffer.byteLength('manifest.json');

        zip.fill(0xff, dataOffset, dataOffset + 8);

        await expect(
            inspectPluginZip(zip),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unsupported data descriptors', async () => {
        const zip = makeZip(validEntries());

        // Set bit 3 in both the local and central headers.
        zip.writeUInt16LE(0x0808, 6);

        const firstNameLength =
            Buffer.byteLength('manifest.json');
        const compressedManifest =
            deflateRawSync(validEntries()[0].data);

        const secondLocalOffset =
            30 + firstNameLength + compressedManifest.length;

        const secondNameLength =
            Buffer.byteLength('translations/fr.json');
        const secondCompressed =
            deflateRawSync(validEntries()[1].data);

        const centralOffset =
            secondLocalOffset +
            30 +
            secondNameLength +
            secondCompressed.length;

        zip.writeUInt16LE(0x0808, centralOffset + 8);

        await expect(
            inspectPluginZip(zip),
        ).rejects.toBeInstanceOf(BadRequestException);
    });
});

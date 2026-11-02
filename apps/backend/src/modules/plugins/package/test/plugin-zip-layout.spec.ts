import { BadRequestException } from '@nestjs/common';
import { deflateRawSync } from 'node:zlib';

import { inspectPluginZip } from '../plugin-zip-reader';

interface FixtureEntry {
  name: string;
  data: Buffer;
  method?: 0 | 8;
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
    crc = crcTable[(crc ^ byte) & 0xff] ^
      (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
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

const fixtureEntries = (): FixtureEntry[] => [
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

interface BuiltZip {
  buffer: Buffer;
  centralOffset: number;
  secondLocalOffset: number;
}

const buildZip = (
  entries: FixtureEntry[],
): BuiltZip => {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];

  let offset = 0;
  let secondLocalOffset = 0;

  for (const [index, entry] of entries.entries()) {
    if (index === 1) {
      secondLocalOffset = offset;
    }

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

    offset +=
      local.length +
      name.length +
      payload.length;
  }

  const centralDirectory =
    Buffer.concat(centralParts);

  const end = Buffer.alloc(22);

  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return {
    buffer: Buffer.concat([
      ...localParts,
      centralDirectory,
      end,
    ]),
    centralOffset: offset,
    secondLocalOffset,
  };
};

const expectRejected = async (
  buffer: Buffer,
): Promise<void> => {
  await expect(
    inspectPluginZip(buffer),
  ).rejects.toBeInstanceOf(BadRequestException);
};

describe('Plugin ZIP layout validation', () => {
  it('accepts a valid DEFLATE archive', async () => {
    const { buffer } = buildZip(
      fixtureEntries(),
    );

    const result = await inspectPluginZip(buffer);

    expect(result.manifest.id).toBe(
      'example.language',
    );
  });

  it('accepts a valid STORE archive', async () => {
    const entries = fixtureEntries().map(
      (entry) => ({
        ...entry,
        method: 0 as const,
      }),
    );

    const { buffer } = buildZip(entries);
    const result = await inspectPluginZip(buffer);

    expect(result.entries).toHaveLength(2);
  });

  it('rejects an archive prefix', async () => {
    const { buffer } = buildZip(
      fixtureEntries(),
    );

    await expectRejected(
      Buffer.concat([
        Buffer.from('hidden'),
        buffer,
      ]),
    );
  });

  it('rejects trailing bytes', async () => {
    const { buffer } = buildZip(
      fixtureEntries(),
    );

    await expectRejected(
      Buffer.concat([
        buffer,
        Buffer.from('hidden'),
      ]),
    );
  });

  it('rejects an archive comment', async () => {
    const { buffer } = buildZip(
      fixtureEntries(),
    );

    buffer.writeUInt16LE(
      1,
      buffer.length - 2,
    );

    await expectRejected(buffer);
  });

  it('rejects a central directory gap', async () => {
    const { buffer, centralOffset } = buildZip(
      fixtureEntries(),
    );

    const mutated = Buffer.concat([
      buffer.subarray(0, centralOffset),
      Buffer.from([0]),
      buffer.subarray(centralOffset),
    ]);

    const endOffset = mutated.length - 22;

    mutated.writeUInt32LE(
      centralOffset + 1,
      endOffset + 16,
    );

    await expectRejected(mutated);
  });

  it('rejects overlapping local records', async () => {
    const { buffer, centralOffset } = buildZip(
      fixtureEntries(),
    );

    const firstNameLength =
      Buffer.byteLength('manifest.json');

    const firstDataStart = 30 + firstNameLength;

    // Make the first local record overlap the second.
    const inflatedCompressedSize =
      centralOffset - firstDataStart;

    buffer.writeUInt32LE(
      inflatedCompressedSize,
      18,
    );

    buffer.writeUInt32LE(
      inflatedCompressedSize,
      centralOffset + 20,
    );

    await expectRejected(buffer);
  });

  it('rejects a ZIP64 size sentinel', async () => {
    const { buffer, centralOffset } = buildZip(
      fixtureEntries(),
    );

    buffer.writeUInt32LE(
      0xffffffff,
      centralOffset + 20,
    );

    await expectRejected(buffer);
  });

  it('rejects a ZIP64 offset sentinel', async () => {
    const { buffer, centralOffset } = buildZip(
      fixtureEntries(),
    );

    buffer.writeUInt32LE(
      0xffffffff,
      centralOffset + 42,
    );

    await expectRejected(buffer);
  });

  it('rejects a multi-disk archive', async () => {
    const { buffer } = buildZip(
      fixtureEntries(),
    );

    buffer.writeUInt16LE(
      1,
      buffer.length - 18,
    );

    await expectRejected(buffer);
  });

  it('rejects a central entry comment', async () => {
    const { buffer, centralOffset } = buildZip(
      fixtureEntries(),
    );

    buffer.writeUInt16LE(
      1,
      centralOffset + 32,
    );

    await expectRejected(buffer);
  });

  it('rejects a central extra field', async () => {
    const { buffer, centralOffset } = buildZip(
      fixtureEntries(),
    );

    buffer.writeUInt16LE(
      1,
      centralOffset + 30,
    );

    await expectRejected(buffer);
  });

  it('rejects a local extra field', async () => {
    const { buffer } = buildZip(
      fixtureEntries(),
    );

    buffer.writeUInt16LE(1, 28);

    await expectRejected(buffer);
  });

  it('rejects an invalid second local offset', async () => {
    const {
      buffer,
      centralOffset,
    } = buildZip(fixtureEntries());

    const firstCentralLength =
      46 + Buffer.byteLength('manifest.json');

    const secondCentral =
      centralOffset + firstCentralLength;

    buffer.writeUInt32LE(
      0,
      secondCentral + 42,
    );

    await expectRejected(buffer);
  });

  it('rejects invalid central flags', async () => {
    const { buffer, centralOffset } = buildZip(
      fixtureEntries(),
    );

    buffer.writeUInt16LE(
      0,
      centralOffset + 8,
    );

    await expectRejected(buffer);
  });

  it('rejects a modified local file name', async () => {
    const { buffer } = buildZip(
      fixtureEntries(),
    );

    buffer[30] = 'x'.charCodeAt(0);

    await expectRejected(buffer);
  });
});

import { BadRequestException } from '@nestjs/common';
import { TextDecoder } from 'node:util';
import * as yauzl from 'yauzl';

import {
  PLUGIN_PACKAGE_LIMITS,
  validatePluginPackageEntries,
  validatePluginPackagePath,
  type PluginPackageEntry,
} from './plugin-package-policy';
import {
  validateLanguagePluginManifest,
  type LanguagePluginManifest,
} from './language-plugin-manifest';
import {
  validateLanguagePluginTranslations,
} from './language-plugin-translations';
import {
  validatePluginZipLocalHeader,
} from './plugin-zip-headers';
import {
  validatePluginZipLayout,
} from './plugin-zip-layout';

const MAX_JSON_BYTES = 1024 * 1024;

const invalidZip = (): BadRequestException =>
  new BadRequestException('Invalid plugin ZIP package.');

const CRC_TABLE = new Uint32Array(256);

for (let i = 0; i < 256; i += 1) {
  let value = i;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1
      ? 0xedb88320 ^ (value >>> 1)
      : value >>> 1;
  }

  CRC_TABLE[i] = value >>> 0;
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

export interface InspectedPluginZip {
  manifest: LanguagePluginManifest;
  entries: PluginPackageEntry[];
  totalExtractedBytes: number;
}

interface CollectedEntries {
  zipEntries: yauzl.Entry[];
  entries: PluginPackageEntry[];
}

const openArchive = (
  buffer: Buffer,
): Promise<yauzl.ZipFile> =>
  new Promise((resolve, reject) => {
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
          reject(invalidZip());
          return;
        }

        resolve(zipFile);
      },
    );
  });

/**
 * Phase 1: collect and validate metadata.
 *
 * No compressed entry data is opened in this phase.
 */
const collectEntries = (
  archive: Buffer,
  zipFile: yauzl.ZipFile,
): Promise<CollectedEntries> =>
  new Promise((resolve, reject) => {
    const zipEntries: yauzl.Entry[] = [];
    const entries: PluginPackageEntry[] = [];
    const seenPaths = new Set<string>();

    let declaredBytes = 0;
    let settled = false;

    const fail = () => {
      if (settled) return;
      settled = true;
      reject(invalidZip());
    };

    zipFile.on('error', fail);

    zipFile.on('entry', (entry: yauzl.Entry) => {
      if (settled) return;

      try {
        validatePluginZipLocalHeader(archive, entry);

        const path = validatePluginPackagePath(
          entry.fileName,
        );

        const collisionKey = path
          .normalize('NFC')
          .toLowerCase();

        if (seenPaths.has(collisionKey)) {
          throw invalidZip();
        }

        seenPaths.add(collisionKey);

        const isDirectory =
          entry.fileName.endsWith('/');

        if (
          entry.generalPurposeBitFlag !== 0x0800 ||
          ![0, 8].includes(entry.compressionMethod)
        ) {
          throw invalidZip();
        }

        const unixMode =
          (entry.externalFileAttributes >>> 16) &
          0xffff;

        const fileType = unixMode & 0xf000;

        if (
          fileType !== 0 &&
          fileType !== 0x8000 &&
          fileType !== 0x4000
        ) {
          throw invalidZip();
        }

        if (
          (isDirectory && fileType === 0x8000) ||
          (!isDirectory && fileType === 0x4000)
        ) {
          throw invalidZip();
        }

        if (
          !Number.isSafeInteger(
            entry.uncompressedSize,
          ) ||
          !Number.isSafeInteger(
            entry.compressedSize,
          ) ||
          entry.uncompressedSize < 0 ||
          entry.compressedSize < 0 ||
          entry.uncompressedSize >
            PLUGIN_PACKAGE_LIMITS.maxFileBytes ||
          (isDirectory &&
            (entry.uncompressedSize !== 0 ||
              entry.compressedSize !== 0))
        ) {
          throw invalidZip();
        }

        const item: PluginPackageEntry = {
          path: entry.fileName,
          size: entry.uncompressedSize,
          kind: isDirectory
            ? 'directory'
            : 'file',
        };

        entries.push(item);
        zipEntries.push(entry);

        if (
          entries.length >
          PLUGIN_PACKAGE_LIMITS.maxFiles
        ) {
          throw invalidZip();
        }

        if (!isDirectory) {
          declaredBytes += entry.uncompressedSize;

          if (
            declaredBytes >
            PLUGIN_PACKAGE_LIMITS.maxExtractedBytes
          ) {
            throw invalidZip();
          }
        }

        zipFile.readEntry();
      } catch {
        fail();
      }
    });

    zipFile.on('end', () => {
      if (settled) return;

      try {
        validatePluginZipLayout(
          archive,
          zipEntries,
        );

        validatePluginPackageEntries(entries);

        settled = true;
        resolve({ zipEntries, entries });
      } catch {
        fail();
      }
    });

    zipFile.readEntry();
  });

/**
 * Phase 2: stream and verify one entry.
 *
 * Every byte contributes to the global decompression
 * budget. Only requested JSON resources are retained.
 */
const readEntry = (
  zipFile: yauzl.ZipFile,
  entry: yauzl.Entry,
  maxBytes: number,
  countBytes: (count: number) => void,
  retain: boolean,
): Promise<Buffer | null> =>
  new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(invalidZip());
        return;
      }

      let settled = false;
      let bytesRead = 0;
      let crc = 0xffffffff;
      const chunks: Buffer[] = [];

      const fail = () => {
        if (settled) return;
        settled = true;
        stream.destroy();
        reject(invalidZip());
      };

      stream.on('data', (chunk: Buffer) => {
        if (settled) return;

        bytesRead += chunk.length;

        if (
          bytesRead > maxBytes ||
          bytesRead > entry.uncompressedSize
        ) {
          fail();
          return;
        }

        try {
          countBytes(chunk.length);
        } catch {
          fail();
          return;
        }

        crc = updateCrc(crc, chunk);

        if (retain) {
          chunks.push(chunk);
        }
      });

      stream.on('error', fail);

      stream.on('end', () => {
        if (settled) return;
        settled = true;

        const checksum =
          (crc ^ 0xffffffff) >>> 0;

        if (
          bytesRead !== entry.uncompressedSize ||
          checksum !== (entry.crc32 >>> 0)
        ) {
          reject(invalidZip());
          return;
        }

        resolve(
          retain ? Buffer.concat(chunks) : null,
        );
      });
    });
  });

const parseJson = (buffer: Buffer): unknown => {
  if (buffer.length > MAX_JSON_BYTES) {
    throw invalidZip();
  }

  try {
    const decoder = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    });

    return JSON.parse(
      decoder.decode(buffer),
    ) as unknown;
  } catch {
    throw invalidZip();
  }
};

/**
 * Inspects a language plugin without writing to disk.
 *
 * Archive metadata and layout are validated before
 * any entry is decompressed.
 *
 * This does not establish publisher trust.
 */
export const inspectPluginZip = async (
  buffer: Buffer,
): Promise<InspectedPluginZip> => {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0 ||
    buffer.length >
      PLUGIN_PACKAGE_LIMITS.maxArchiveBytes
  ) {
    throw invalidZip();
  }

  let zipFile: yauzl.ZipFile | undefined;

  try {
    zipFile = await openArchive(buffer);

    const collected = await collectEntries(
      buffer,
      zipFile,
    );

    const validated = validatePluginPackageEntries(
      collected.entries,
    );

    const manifestEntry = collected.zipEntries.find(
      (entry) => entry.fileName === 'manifest.json',
    );

    if (!manifestEntry) {
      throw invalidZip();
    }

    // Read the manifest first so we retain only the
    // exact translation resource it references.
    let actualBytes = 0;

    const countBytes = (count: number) => {
      actualBytes += count;

      if (
        actualBytes >
        PLUGIN_PACKAGE_LIMITS.maxExtractedBytes
      ) {
        throw invalidZip();
      }
    };

    const manifestBuffer = await readEntry(
      zipFile,
      manifestEntry,
      MAX_JSON_BYTES,
      countBytes,
      true,
    );

    if (!manifestBuffer) {
      throw invalidZip();
    }

    const manifestData = parseJson(
      manifestBuffer,
    );

    if (
      !validateLanguagePluginManifest(
        manifestData,
      )
    ) {
      throw invalidZip();
    }

    const translationPath =
      manifestData.translations.path.slice(2);

    const translationEntry =
      collected.zipEntries.find(
        (entry) =>
          entry.fileName === translationPath &&
          !entry.fileName.endsWith('/'),
      );

    if (!translationEntry) {
      throw invalidZip();
    }

    // Verify all remaining entries, including files
    // that are not referenced by the manifest.
    let translationBuffer: Buffer | null = null;

    for (const entry of collected.zipEntries) {
      if (
        entry.fileName.endsWith('/') ||
        entry === manifestEntry
      ) {
        continue;
      }

      const isTranslation =
        entry === translationEntry;

      const data = await readEntry(
        zipFile,
        entry,
        isTranslation
          ? MAX_JSON_BYTES
          : PLUGIN_PACKAGE_LIMITS.maxFileBytes,
        countBytes,
        isTranslation,
      );

      if (isTranslation) {
        translationBuffer = data;
      }
    }

    if (!translationBuffer) {
      throw invalidZip();
    }

    const translationData = parseJson(
      translationBuffer,
    );

    if (
      !validateLanguagePluginTranslations(
        translationData,
      )
    ) {
      throw invalidZip();
    }

    return {
      manifest: manifestData,
      entries: validated.entries,
      totalExtractedBytes:
        validated.totalExtractedBytes,
    };
  } catch {
    throw invalidZip();
  } finally {
    zipFile?.close();
  }
};

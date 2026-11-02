import { BadRequestException } from '@nestjs/common';
import type * as yauzl from 'yauzl';

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;

const LOCAL_SIZE = 30;
const CENTRAL_SIZE = 46;
const END_SIZE = 22;
const REQUIRED_FLAGS = 0x0800;

const invalidLayout = (): BadRequestException =>
  new BadRequestException('Invalid plugin ZIP layout.');

interface Range {
  start: number;
  end: number;
}

const range = (
  start: number,
  length: number,
  limit: number,
): Range => {
  const end = start + length;

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(length) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    length < 0 ||
    end > limit
  ) {
    throw invalidLayout();
  }

  return { start, end };
};

/**
 * Validates a conventional single-disk ZIP archive.
 *
 * No ZIP64, comments, extra fields, data descriptors,
 * prefixes, gaps, overlapping records or trailing data.
 */
export const validatePluginZipLayout = (
  archive: Buffer,
  entries: readonly yauzl.Entry[],
): void => {
  if (archive.length < END_SIZE) {
    throw invalidLayout();
  }

  const endOffset = archive.length - END_SIZE;

  if (
    archive.readUInt32LE(endOffset) !==
    END_SIGNATURE
  ) {
    throw invalidLayout();
  }

  const disk = archive.readUInt16LE(
    endOffset + 4,
  );
  const centralDisk = archive.readUInt16LE(
    endOffset + 6,
  );
  const diskEntries = archive.readUInt16LE(
    endOffset + 8,
  );
  const totalEntries = archive.readUInt16LE(
    endOffset + 10,
  );
  const centralSize = archive.readUInt32LE(
    endOffset + 12,
  );
  const centralOffset = archive.readUInt32LE(
    endOffset + 16,
  );
  const commentLength = archive.readUInt16LE(
    endOffset + 20,
  );

  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    diskEntries !== totalEntries ||
    totalEntries !== entries.length ||
    totalEntries === 0 ||
    totalEntries === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff ||
    commentLength !== 0
  ) {
    throw invalidLayout();
  }

  const centralRange = range(
    centralOffset,
    centralSize,
    archive.length,
  );

  if (centralRange.end !== endOffset) {
    throw invalidLayout();
  }

  const localRanges: Range[] = [];
  let cursor = centralOffset;

  for (const entry of entries) {
    range(cursor, CENTRAL_SIZE, endOffset);

    if (
      archive.readUInt32LE(cursor) !==
      CENTRAL_SIGNATURE
    ) {
      throw invalidLayout();
    }

    const flags = archive.readUInt16LE(
      cursor + 8,
    );
    const method = archive.readUInt16LE(
      cursor + 10,
    );
    const crc = archive.readUInt32LE(
      cursor + 16,
    );
    const compressed = archive.readUInt32LE(
      cursor + 20,
    );
    const uncompressed = archive.readUInt32LE(
      cursor + 24,
    );
    const nameLength = archive.readUInt16LE(
      cursor + 28,
    );
    const extraLength = archive.readUInt16LE(
      cursor + 30,
    );
    const commentLength = archive.readUInt16LE(
      cursor + 32,
    );
    const startDisk = archive.readUInt16LE(
      cursor + 34,
    );
    const internalAttributes = archive.readUInt16LE(
      cursor + 36,
    );
    const localOffset = archive.readUInt32LE(
      cursor + 42,
    );

    if (
      flags !== REQUIRED_FLAGS ||
      flags !== entry.generalPurposeBitFlag ||
      ![0, 8].includes(method) ||
      method !== entry.compressionMethod ||
      crc !== entry.crc32 ||
      compressed !== entry.compressedSize ||
      uncompressed !== entry.uncompressedSize ||
      compressed === 0xffffffff ||
      uncompressed === 0xffffffff ||
      localOffset === 0xffffffff ||
      localOffset !==
        entry.relativeOffsetOfLocalHeader ||
      extraLength !== 0 ||
      commentLength !== 0 ||
      startDisk !== 0 ||
      internalAttributes !== 0
    ) {
      throw invalidLayout();
    }

    const name = Buffer.from(
      entry.fileName,
      'utf8',
    );

    if (name.length !== nameLength) {
      throw invalidLayout();
    }

    const centralNameStart =
      cursor + CENTRAL_SIZE;

    const centralName = range(
      centralNameStart,
      nameLength,
      endOffset,
    );

    if (
      !archive
        .subarray(
          centralName.start,
          centralName.end,
        )
        .equals(name)
    ) {
      throw invalidLayout();
    }

    cursor = centralName.end;

    range(
      localOffset,
      LOCAL_SIZE,
      centralOffset,
    );

    if (
      archive.readUInt32LE(localOffset) !==
      LOCAL_SIGNATURE
    ) {
      throw invalidLayout();
    }

    const localFlags = archive.readUInt16LE(
      localOffset + 6,
    );
    const localMethod = archive.readUInt16LE(
      localOffset + 8,
    );
    const localCrc = archive.readUInt32LE(
      localOffset + 14,
    );
    const localCompressed = archive.readUInt32LE(
      localOffset + 18,
    );
    const localUncompressed = archive.readUInt32LE(
      localOffset + 22,
    );
    const localNameLength = archive.readUInt16LE(
      localOffset + 26,
    );
    const localExtraLength = archive.readUInt16LE(
      localOffset + 28,
    );

    if (
      localFlags !== flags ||
      localMethod !== method ||
      localCrc !== crc ||
      localCompressed !== compressed ||
      localUncompressed !== uncompressed ||
      localNameLength !== nameLength ||
      localExtraLength !== 0
    ) {
      throw invalidLayout();
    }

    const localNameStart =
      localOffset + LOCAL_SIZE;

    const localName = range(
      localNameStart,
      localNameLength,
      centralOffset,
    );

    if (
      !archive
        .subarray(
          localName.start,
          localName.end,
        )
        .equals(name)
    ) {
      throw invalidLayout();
    }

    const data = range(
      localName.end,
      compressed,
      centralOffset,
    );

    localRanges.push({
      start: localOffset,
      end: data.end,
    });
  }

  if (cursor !== endOffset) {
    throw invalidLayout();
  }

  localRanges.sort(
    (left, right) => left.start - right.start,
  );

  let expectedOffset = 0;

  for (const item of localRanges) {
    if (item.start !== expectedOffset) {
      throw invalidLayout();
    }

    expectedOffset = item.end;
  }

  if (expectedOffset !== centralOffset) {
    throw invalidLayout();
  }
};

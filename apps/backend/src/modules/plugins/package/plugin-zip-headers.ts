import { BadRequestException } from '@nestjs/common';
import type * as yauzl from 'yauzl';

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const LOCAL_HEADER_LENGTH = 30;
const UTF8_FLAG = 0x0800;
const DATA_DESCRIPTOR_FLAG = 0x0008;

const invalidHeader = (): BadRequestException =>
  new BadRequestException('Invalid plugin ZIP headers.');

/**
 * Validates local ZIP headers against the central directory.
 *
 * Data descriptors are deliberately unsupported at this stage.
 * This validator must run before opening each entry stream.
 */
export const validatePluginZipLocalHeader = (
  archive: Buffer,
  entry: yauzl.Entry,
): void => {
  const offset = entry.relativeOffsetOfLocalHeader;

  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > archive.length - LOCAL_HEADER_LENGTH
  ) {
    throw invalidHeader();
  }

  if (
    archive.readUInt32LE(offset) !==
    LOCAL_HEADER_SIGNATURE
  ) {
    throw invalidHeader();
  }

  const flags = archive.readUInt16LE(offset + 6);
  const method = archive.readUInt16LE(offset + 8);
  const checksum = archive.readUInt32LE(offset + 14);
  const compressedSize = archive.readUInt32LE(offset + 18);
  const uncompressedSize = archive.readUInt32LE(offset + 22);
  const nameLength = archive.readUInt16LE(offset + 26);
  const extraLength = archive.readUInt16LE(offset + 28);

  if (
    (flags & DATA_DESCRIPTOR_FLAG) !== 0 ||
    (flags & UTF8_FLAG) === 0 ||
    flags !== entry.generalPurposeBitFlag ||
    method !== entry.compressionMethod ||
    checksum !== entry.crc32 ||
    compressedSize !== entry.compressedSize ||
    uncompressedSize !== entry.uncompressedSize
  ) {
    throw invalidHeader();
  }

  const nameStart = offset + LOCAL_HEADER_LENGTH;
  const nameEnd = nameStart + nameLength;
  const dataStart = nameEnd + extraLength;
  const dataEnd = dataStart + entry.compressedSize;

  if (
    nameEnd > archive.length ||
    dataStart > archive.length ||
    dataEnd > archive.length ||
    !Number.isSafeInteger(dataEnd)
  ) {
    throw invalidHeader();
  }

  const expectedName = Buffer.from(
    entry.fileName,
    'utf8',
  );

  if (
    nameLength !== expectedName.length ||
    !archive.subarray(nameStart, nameEnd).equals(
      expectedName,
    )
  ) {
    throw invalidHeader();
  }
};

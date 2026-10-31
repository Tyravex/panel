import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as actualFs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';
import { PluginInstallerService } from '../plugin-installer.service';
import { stagePluginPackage } from '../plugin-package-staging';
import { PLUGIN_STORAGE_ENV_KEY } from '../plugin-storage.config';

jest.mock('node:fs/promises', () => {
  const actual = jest.requireActual('node:fs/promises');

  return {
    ...actual,
    mkdir: jest.fn(actual.mkdir),
    rm: jest.fn(actual.rm),
  };
});

jest.mock('../plugin-package-staging', () => {
  const actual = jest.requireActual('../plugin-package-staging');

  return {
    ...actual,
    stagePluginPackage: jest.fn(),
  };
});

const fs = jest.requireActual<
  typeof import('node:fs/promises')
>('node:fs/promises');

const mkdirMock = jest.mocked(actualFs.mkdir);
const rmMock = jest.mocked(actualFs.rm);
const stageMock = jest.mocked(stagePluginPackage);

const manifest = {
  schemaVersion: 1 as const,
  id: 'example.language',
  type: 'language' as const,
  version: '1.0.0',
  language: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
  },
  translations: {
    namespace: 'translation' as const,
    path: './translations/fr.json',
  },
};

describe('Plugin installer failure handling', () => {
  let temporaryRoot: string;
  let storageRoot: string;
  let previousStorage: string | undefined;

  const prisma = {
    plugin: {
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  let installer: PluginInstallerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    mkdirMock.mockImplementation(fs.mkdir);
    rmMock.mockImplementation(fs.rm);

    previousStorage = process.env[PLUGIN_STORAGE_ENV_KEY];

    temporaryRoot = await fs.mkdtemp(
      join(tmpdir(), 'tyravex-failures-'),
    );

    storageRoot = join(temporaryRoot, 'plugins');
    await fs.mkdir(storageRoot);

    process.env[PLUGIN_STORAGE_ENV_KEY] = storageRoot;

    prisma.plugin.create.mockResolvedValue({});
    prisma.plugin.updateMany.mockResolvedValue({ count: 1 });
    prisma.plugin.deleteMany.mockResolvedValue({ count: 1 });

    stageMock.mockImplementation(async () => {
      const stagingPath = await fs.mkdtemp(
        join(storageRoot, `.staging-${randomUUID()}-`),
      );

      await fs.writeFile(
        join(stagingPath, 'manifest.json'),
        JSON.stringify(manifest),
      );

      return {
        stagingPath,
        inspection: {
          manifest,
          entries: [],
          totalExtractedBytes: 0,
        },
      } as Awaited<ReturnType<typeof stagePluginPackage>>;
    });

    installer = new PluginInstallerService(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(async () => {
    mkdirMock.mockImplementation(fs.mkdir);
    rmMock.mockImplementation(fs.rm);

    if (previousStorage === undefined) {
      delete process.env[PLUGIN_STORAGE_ENV_KEY];
    } else {
      process.env[PLUGIN_STORAGE_ENV_KEY] = previousStorage;
    }

    await fs.rm(temporaryRoot, {
      recursive: true,
      force: true,
    });
  });

  it('does not delete an existing directory after mkdir collision', async () => {
    const originalMkdir = fs.mkdir;

    mkdirMock.mockImplementation(async (path, options) => {
      const target = String(path);

      if (
        target.startsWith(
          join(storageRoot, 'example.language-'),
        )
      ) {
        await originalMkdir(target);

        await fs.writeFile(
          join(target, 'owner.txt'),
          'do-not-delete',
        );

        throw Object.assign(
          new Error('Directory already exists'),
          { code: 'EEXIST' },
        );
      }

      return originalMkdir(path, options);
    });

    await expect(
      installer.installLanguagePackage(Buffer.from('fixture')),
    ).rejects.toMatchObject({
      code: 'EEXIST',
    });

    const names = await fs.readdir(storageRoot);

    const reservationName = names.find((name) =>
      name.startsWith('example.language-'),
    );

    expect(reservationName).toBeDefined();

    expect(
      await fs.readFile(
        join(storageRoot, reservationName!, 'owner.txt'),
        'utf8',
      ),
    ).toBe('do-not-delete');

    expect(prisma.plugin.deleteMany).toHaveBeenCalledTimes(1);

    expect(
      rmMock.mock.calls.some(
        ([path]) =>
          String(path) ===
          join(storageRoot, reservationName!),
      ),
    ).toBe(false);
  });

  it('marks FAILED when filesystem rollback fails', async () => {
    prisma.plugin.updateMany
      .mockRejectedValueOnce(new Error('Activation failed'))
      .mockResolvedValueOnce({ count: 1 });

    rmMock.mockImplementation(async (path, options) => {
      const target = String(path);

      if (
        target.startsWith(
          join(storageRoot, 'example.language-'),
        )
      ) {
        throw Object.assign(
          new Error('Access denied'),
          { code: 'EACCES' },
        );
      }

      return fs.rm(path, options);
    });

    await expect(
      installer.installLanguagePackage(Buffer.from('fixture')),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(prisma.plugin.deleteMany).not.toHaveBeenCalled();

    const storagePath =
      prisma.plugin.create.mock.calls[0][0].data.storagePath;

    expect(prisma.plugin.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'example.language',
        type: 'LANGUAGE',
        version: '1.0.0',
        status: 'INSTALLING',
        storagePath,
      },
      data: {
        status: 'FAILED',
      },
    });

    const names = await fs.readdir(storageRoot);

    expect(
      names.some((name) =>
        name.startsWith('example.language-'),
      ),
    ).toBe(true);
  });

  it('allows only one concurrent reservation of the same plugin ID', async () => {
    let reserved = false;

    prisma.plugin.create.mockImplementation(async () => {
      if (reserved) {
        throw { code: 'P2002' };
      }

      reserved = true;
      return {};
    });

    const results = await Promise.allSettled([
      installer.installLanguagePackage(Buffer.from('first')),
      installer.installLanguagePackage(Buffer.from('second')),
    ]);

    const fulfilled = results.filter(
      (result) => result.status === 'fulfilled',
    );

    const rejected = results.filter(
      (result) => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    expect(
      (rejected[0] as PromiseRejectedResult).reason,
    ).toBeInstanceOf(ConflictException);

    expect(prisma.plugin.updateMany).toHaveBeenCalledTimes(1);

    const names = await fs.readdir(storageRoot);

    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^example\.language-/);
  });

  it('marks FAILED when database rollback fails', async () => {
    prisma.plugin.updateMany
      .mockRejectedValueOnce(new Error('Activation failed'))
      .mockResolvedValueOnce({ count: 1 });

    prisma.plugin.deleteMany.mockRejectedValue(
      new Error('Rollback failed'),
    );

    await expect(
      installer.installLanguagePackage(Buffer.from('fixture')),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(prisma.plugin.deleteMany).toHaveBeenCalledTimes(1);

    expect(prisma.plugin.updateMany).toHaveBeenLastCalledWith({
      where: expect.objectContaining({
        id: 'example.language',
        status: 'INSTALLING',
      }),
      data: {
        status: 'FAILED',
      },
    });

    expect(await fs.readdir(storageRoot)).toEqual([]);
  });
});

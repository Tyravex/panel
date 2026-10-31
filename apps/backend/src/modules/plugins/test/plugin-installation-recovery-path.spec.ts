import { randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';

import {
  inspectIncompletePluginInstallations,
} from '../plugin-installation-recovery';
import {
  PLUGIN_STORAGE_ENV_KEY,
} from '../plugin-storage.config';

describe('Plugin recovery storage paths', () => {
  let temporaryRoot: string;
  let storageRoot: string;
  let previousStorage: string | undefined;

  const prisma = {
    plugin: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    previousStorage =
      process.env[PLUGIN_STORAGE_ENV_KEY];

    temporaryRoot = await mkdtemp(
      join(tmpdir(), 'tyravex-recovery-path-'),
    );

    storageRoot = join(
      temporaryRoot,
      'plugins',
    );

    await mkdir(storageRoot);

    process.env[PLUGIN_STORAGE_ENV_KEY] =
      storageRoot;
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

  it('recognizes an unfinished installation with /package suffix', async () => {
    const directoryName =
      `example.language-${randomUUID()}`;

    const storagePath =
      `${directoryName}/package`;

    await mkdir(
      join(storageRoot, directoryName),
    );

    await mkdir(
      join(storageRoot, directoryName, 'package'),
    );

    const installedAt = new Date(
      '2026-10-29T10:00:00.000Z',
    );

    prisma.plugin.findMany.mockResolvedValue([
      {
        id: 'example.language',
        storagePath,
        installedAt,
      },
    ]);

    const report =
      await inspectIncompletePluginInstallations(
        prisma as unknown as PrismaService,
        new Date(
          '2026-10-29T12:00:00.000Z',
        ),
      );

    expect(
      report.incompleteInstallations,
    ).toEqual([
      {
        id: 'example.language',
        storagePath,
        installedAt,
        directoryState: 'present',
      },
    ]);
  });

  it('reports missing package directories', async () => {
    const storagePath =
      `example.language-${randomUUID()}/package`;

    prisma.plugin.findMany.mockResolvedValue([
      {
        id: 'example.language',
        storagePath,
        installedAt: new Date(
          '2026-10-29T10:00:00.000Z',
        ),
      },
    ]);

    const report =
      await inspectIncompletePluginInstallations(
        prisma as unknown as PrismaService,
        new Date(
          '2026-10-29T12:00:00.000Z',
        ),
      );

    expect(
      report.incompleteInstallations[0]
        .directoryState,
    ).toBe('missing');
  });

  it('rejects paths that merely resemble installation paths', async () => {
    prisma.plugin.findMany.mockResolvedValue([
      {
        id: 'example.language',
        storagePath:
          `other.language-${randomUUID()}/package`,
        installedAt: new Date(
          '2026-10-29T10:00:00.000Z',
        ),
      },
    ]);

    const report =
      await inspectIncompletePluginInstallations(
        prisma as unknown as PrismaService,
        new Date(
          '2026-10-29T12:00:00.000Z',
        ),
      );

    expect(
      report.incompleteInstallations,
    ).toEqual([]);
  });
});

import { randomUUID } from 'node:crypto';
import {
    mkdir,
    mkdtemp,
    readdir,
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

describe('Plugin installation recovery', () => {
    const now = new Date('2026-10-29T12:00:00.000Z');
    const oldDate = new Date('2026-10-29T10:00:00.000Z');
    const cutoff = new Date('2026-10-29T11:30:00.000Z');

    let temporaryRoot: string;
    let storageRoot: string;
    let previousStorage: string | undefined;

    const prisma = {
        plugin: {
            findMany: jest.fn(),
            updateMany: jest.fn(),
            deleteMany: jest.fn(),
            delete: jest.fn(),
        },
    };

    const inspect = () =>
        inspectIncompletePluginInstallations(
            prisma as unknown as PrismaService,
            now,
        );

    beforeEach(async () => {
        jest.clearAllMocks();

        previousStorage = process.env[PLUGIN_STORAGE_ENV_KEY];

        temporaryRoot = await mkdtemp(
            join(tmpdir(), 'tyravex-recovery-'),
        );

        storageRoot = join(temporaryRoot, 'plugins');
        await mkdir(storageRoot);

        process.env[PLUGIN_STORAGE_ENV_KEY] = storageRoot;

        prisma.plugin.findMany.mockResolvedValue([]);
    });

    afterEach(async () => {
        if (previousStorage === undefined) {
            delete process.env[PLUGIN_STORAGE_ENV_KEY];
        } else {
            process.env[PLUGIN_STORAGE_ENV_KEY] = previousStorage;
        }

        await rm(temporaryRoot, {
            recursive: true,
            force: true,
        });
    });

    it('reports a stale INSTALLING reservation with missing files', async () => {
        const storagePath =
            `example.language-${randomUUID()}/package`;

        prisma.plugin.findMany.mockResolvedValue([
            {
                id: 'example.language',
                storagePath,
                installedAt: oldDate,
            },
        ]);

        const report = await inspect();

        expect(report.incompleteInstallations).toEqual([
            {
                id: 'example.language',
                storagePath,
                installedAt: oldDate,
                directoryState: 'missing',
            },
        ]);

        expect(prisma.plugin.findMany).toHaveBeenCalledWith({
            where: {
                type: 'LANGUAGE',
                status: {
                    in: ['INSTALLING', 'FAILED'],
                },
                installedAt: {
                    lt: cutoff,
                },
            },
            select: expect.objectContaining({
                id: true,
                storagePath: true,
                installedAt: true,
            }),
        });
    });

    it('reports a stale INSTALLING reservation with published files', async () => {
        const directoryName =
            `example.language-${randomUUID()}`;

        const storagePath = `${directoryName}/package`;

        await mkdir(join(storageRoot, directoryName));
        await mkdir(join(storageRoot, storagePath));

        prisma.plugin.findMany.mockResolvedValue([
            {
                id: 'example.language',
                storagePath,
                installedAt: oldDate,
            },
        ]);

        const report = await inspect();

        expect(report.incompleteInstallations).toEqual([
            {
                id: 'example.language',
                storagePath,
                installedAt: oldDate,
                directoryState: 'present',
            },
        ]);
    });

    it('does not query ordinary DISABLED plugins', async () => {
        const report = await inspect();

        expect(report.incompleteInstallations).toEqual([]);

        expect(prisma.plugin.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: {
                        in: ['INSTALLING', 'FAILED'],
                    },
                }),
            }),
        );
    });

    it('reports staging directories without deleting them', async () => {
        const stagingName = `.staging-${randomUUID()}-abc123`;

        await mkdir(join(storageRoot, stagingName));

        const report = await inspect();

        expect(JSON.stringify(report)).toContain(stagingName);

        expect(await readdir(storageRoot)).toContain(stagingName);
    });

    it('ignores unrelated directories', async () => {
        await mkdir(join(storageRoot, 'unrelated-directory'));

        const report = await inspect();

        expect(report.incompleteInstallations).toEqual([]);
        expect(JSON.stringify(report)).not.toContain(
            'unrelated-directory',
        );
    });

    it('does not modify database records or filesystem entries', async () => {
        const stagingName = `.staging-${randomUUID()}-abc123`;

        await mkdir(join(storageRoot, stagingName));

        await inspect();

        expect(prisma.plugin.updateMany).not.toHaveBeenCalled();
        expect(prisma.plugin.deleteMany).not.toHaveBeenCalled();
        expect(prisma.plugin.delete).not.toHaveBeenCalled();

        expect(await readdir(storageRoot)).toContain(stagingName);
    });
});

import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';
import { PluginInstallerService } from '../plugin-installer.service';
import { stagePluginPackage } from '../plugin-package-staging';
import { PLUGIN_STORAGE_ENV_KEY } from '../plugin-storage.config';

jest.mock('../plugin-package-staging', () => {
    const actual = jest.requireActual('../plugin-package-staging');

    return {
        ...actual,
        stagePluginPackage: jest.fn(),
    };
});

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

describe('PluginInstallerService', () => {
    let temporaryRoot: string;
    let storageRoot: string;
    let previousStorage: string | undefined;
    let service: PluginInstallerService;

    const prisma = {
        plugin: {
            create: jest.fn(),
            updateMany: jest.fn(),
            deleteMany: jest.fn(),
        },
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        previousStorage = process.env[PLUGIN_STORAGE_ENV_KEY];

        temporaryRoot = await mkdtemp(
            join(tmpdir(), 'tyravex-installer-'),
        );

        storageRoot = join(temporaryRoot, 'plugins');
        await mkdir(storageRoot);

        process.env[PLUGIN_STORAGE_ENV_KEY] = storageRoot;

        prisma.plugin.create.mockResolvedValue({});
        prisma.plugin.updateMany.mockResolvedValue({ count: 1 });
        prisma.plugin.deleteMany.mockResolvedValue({ count: 1 });

        stageMock.mockImplementation(async () => {
            const stagingPath = await mkdtemp(
                join(storageRoot, `.staging-${randomUUID()}-`),
            );

            await writeFile(
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

        service = new PluginInstallerService(
            prisma as unknown as PrismaService,
        );
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

    it('reserves INSTALLING and activates INSTALLED after publishing', async () => {
        const result = await service.installLanguagePackage(
            Buffer.from('fixture'),
        );

        expect(result).toEqual({
            id: 'example.language',
            type: 'LANGUAGE',
            version: '1.0.0',
            status: 'INSTALLED',
        });

        expect(prisma.plugin.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                id: 'example.language',
                type: 'LANGUAGE',
                version: '1.0.0',
                status: 'INSTALLING',
                sourceRepository: null,
                storagePath: expect.stringMatching(
                    /^example\.language-[0-9a-f-]+\/package$/,
                ),
            }),
        });

        const storagePath =
            prisma.plugin.create.mock.calls[0][0].data.storagePath;

        expect(prisma.plugin.updateMany).toHaveBeenCalledWith({
            where: {
                id: 'example.language',
                type: 'LANGUAGE',
                version: '1.0.0',
                status: 'INSTALLING',
                storagePath,
            },
            data: {
                status: 'INSTALLED',
            },
        });

        expect(
            JSON.parse(
                await readFile(
                    join(storageRoot, storagePath, 'manifest.json'),
                    'utf8',
                ),
            ),
        ).toEqual(manifest);

        expect(prisma.plugin.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects duplicate plugin IDs and cleans staging', async () => {
        prisma.plugin.create.mockRejectedValue({
            code: 'P2002',
        });

        await expect(
            service.installLanguagePackage(Buffer.from('fixture')),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(prisma.plugin.updateMany).not.toHaveBeenCalled();
        expect(prisma.plugin.deleteMany).not.toHaveBeenCalled();

        expect(await readdir(storageRoot)).toEqual([]);
    });

    it('removes the reservation after an activation error and successful rollback', async () => {
        prisma.plugin.updateMany.mockRejectedValue(
            new Error('Activation failed'),
        );

        await expect(
            service.installLanguagePackage(Buffer.from('fixture')),
        ).rejects.toThrow('Activation failed');

        const storagePath =
            prisma.plugin.create.mock.calls[0][0].data.storagePath;

        expect(prisma.plugin.deleteMany).toHaveBeenCalledWith({
            where: {
                id: 'example.language',
                type: 'LANGUAGE',
                version: '1.0.0',
                status: 'INSTALLING',
                storagePath,
            },
        });

        expect(await readdir(storageRoot)).toEqual([]);
    });

    it('rolls back when the reservation changes before activation', async () => {
        prisma.plugin.updateMany.mockResolvedValue({
            count: 0,
        });

        await expect(
            service.installLanguagePackage(Buffer.from('fixture')),
        ).rejects.toThrow(
            'Plugin reservation was modified during installation.',
        );

        expect(prisma.plugin.deleteMany).toHaveBeenCalledTimes(1);
        expect(await readdir(storageRoot)).toEqual([]);
    });

    it('marks the reservation FAILED when database rollback fails', async () => {
        prisma.plugin.updateMany
            .mockRejectedValueOnce(new Error('Activation failed'))
            .mockResolvedValueOnce({ count: 1 });

        prisma.plugin.deleteMany.mockRejectedValue(
            new Error('Rollback failed'),
        );

        await expect(
            service.installLanguagePackage(Buffer.from('fixture')),
        ).rejects.toBeInstanceOf(InternalServerErrorException);

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

        expect(await readdir(storageRoot)).toEqual([]);
    });
});

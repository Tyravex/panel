import { requireIntegrationDatabase } from '@/test/test-database.guard';
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
    mkdtemp,
    readFile,
    readdir,
    rm,
    stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';

import { PluginInstallerService } from '../plugin-installer.service';
import { PLUGIN_STORAGE_ENV_KEY } from '../../storage/plugin-storage.config';

const safeDatabaseUrl = requireIntegrationDatabase();

const CRC_TABLE = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1
            ? 0xedb88320 ^ (value >>> 1)
            : value >>> 1;
    }

    CRC_TABLE[index] = value >>> 0;
}

function crc32(data: Buffer): number {
    let value = 0xffffffff;

    for (const byte of data) {
        value =
            CRC_TABLE[(value ^ byte) & 0xff] ^
            (value >>> 8);
    }

    return (value ^ 0xffffffff) >>> 0;
}

function createZip(files: Record<string, string>): Buffer {
    const localRecords: Buffer[] = [];
    const centralRecords: Buffer[] = [];

    let offset = 0;

    for (const [path, content] of Object.entries(files)) {
        const name = Buffer.from(path, 'utf8');
        const data = Buffer.from(content, 'utf8');
        const checksum = crc32(data);

        const local = Buffer.alloc(30);

        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(0, 8);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);

        localRecords.push(local, name, data);

        const central = Buffer.alloc(46);

        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);

        centralRecords.push(central, name);

        offset += local.length + name.length + data.length;
    }

    const centralDirectory = Buffer.concat(centralRecords);
    const end = Buffer.alloc(22);

    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(Object.keys(files).length, 8);
    end.writeUInt16LE(Object.keys(files).length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([
        ...localRecords,
        centralDirectory,
        end,
    ]);
}

function createLanguageZip(
    id: string,
    languageCode: string,
): Buffer {
    return createZip({
        'manifest.json': JSON.stringify({
            schemaVersion: 1,
            id,
            type: 'language',
            version: '1.0.0',
            language: {
                code: languageCode,
                name: 'Integration Test Language',
                nativeName: 'Integration Test Language',
            },
            translations: {
                namespace: 'translation',
                path: './locales/translations.json',
            },
        }),
        'locales/translations.json': JSON.stringify({
            common: {
                hello: 'Hello from PostgreSQL integration test',
            },
        }),
    });
}

describe('Plugin installer PostgreSQL integration', () => {
    let prisma: PrismaService;
    let installer: PluginInstallerService;
    let storageRoot: string;

    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousStorageRoot =
        process.env[PLUGIN_STORAGE_ENV_KEY];

    const createdPluginIds = new Set<string>();
    const createdLanguageCodes = new Set<string>();

    function nextPluginId(): string {
        const id = `integration.database.${randomUUID()}`;
        createdPluginIds.add(id);
        return id;
    }

    function nextLanguageCode(): string {
        const code = `qz-${randomUUID().slice(0, 8)}`;
        createdLanguageCodes.add(code);
        return code;
    }

    async function cleanupDatabase(): Promise<void> {
        if (createdPluginIds.size === 0) {
            return;
        }

        await prisma.language.deleteMany({
            where: {
                OR: [
                    {
                        pluginId: {
                            in: [...createdPluginIds],
                        },
                    },
                    {
                        code: {
                            in: [...createdLanguageCodes],
                        },
                    },
                ],
            },
        });

        await prisma.plugin.deleteMany({
            where: {
                id: {
                    in: [...createdPluginIds],
                },
            },
        });
    }

    async function expectNoStagingDirectories(): Promise<void> {
        const directories = await readdir(storageRoot);

        expect(
            directories.filter((name) =>
                name.startsWith('.staging-'),
            ),
        ).toEqual([]);
    }

    beforeAll(async () => {
        process.env.DATABASE_URL = safeDatabaseUrl;

        storageRoot = await mkdtemp(
            join(tmpdir(), 'tyravex-plugin-db-test-'),
        );

        process.env[PLUGIN_STORAGE_ENV_KEY] = storageRoot;

        prisma = new PrismaService();
        installer = new PluginInstallerService(prisma);

        await prisma.$connect();
    });

    afterAll(async () => {
        try {
            if (prisma) {
                try {
                    await cleanupDatabase();
                } finally {
                    await prisma.$disconnect();
                }
            }
        } finally {
            if (previousDatabaseUrl === undefined) {
                delete process.env.DATABASE_URL;
            } else {
                process.env.DATABASE_URL = previousDatabaseUrl;
            }

            if (previousStorageRoot === undefined) {
                delete process.env[PLUGIN_STORAGE_ENV_KEY];
            } else {
                process.env[PLUGIN_STORAGE_ENV_KEY] =
                    previousStorageRoot;
            }

            if (storageRoot) {
                await rm(storageRoot, {
                    recursive: true,
                    force: true,
                });
            }
        }
    });

    it('installs a real ZIP and registers its language in PostgreSQL', async () => {
        const id = nextPluginId();
        const code = nextLanguageCode();
        const archive = createLanguageZip(id, code);

        const result = await installer.installLanguagePackage(
            archive,
        );

        expect(result).toEqual({
            id,
            type: 'LANGUAGE',
            version: '1.0.0',
            status: 'INSTALLED',
        });

        const plugin = await prisma.plugin.findUniqueOrThrow({
            where: { id },
        });

        const language = await prisma.language.findUniqueOrThrow({
            where: { code },
        });

        expect(plugin.status).toBe('INSTALLED');
        expect(plugin.type).toBe('LANGUAGE');

        expect(language.pluginId).toBe(id);
        expect(language.isBuiltIn).toBe(false);
        expect(language.isEnabled).toBe(true);

        const packageDirectory = join(
            storageRoot,
            plugin.storagePath,
        );

        expect(
            (await stat(packageDirectory)).isDirectory(),
        ).toBe(true);

        const manifest = JSON.parse(
            await readFile(
                join(packageDirectory, 'manifest.json'),
                'utf8',
            ),
        ) as {
            id: string;
            language: { code: string };
        };

        expect(manifest.id).toBe(id);
        expect(manifest.language.code).toBe(code);

        await expectNoStagingDirectories();
    });

    it('rejects duplicate plugin IDs without changing existing records', async () => {
        const id = nextPluginId();
        const code = nextLanguageCode();
        const archive = createLanguageZip(id, code);

        await installer.installLanguagePackage(archive);

        const directoriesBefore = await readdir(storageRoot);

        await expect(
            installer.installLanguagePackage(archive),
        ).rejects.toBeInstanceOf(ConflictException);

        const plugin = await prisma.plugin.findUniqueOrThrow({
            where: { id },
        });

        const languages = await prisma.language.findMany({
            where: { pluginId: id },
        });

        expect(plugin.status).toBe('INSTALLED');
        expect(languages).toHaveLength(1);

        const directoriesAfter = await readdir(storageRoot);

        expect(directoriesAfter.sort()).toEqual(
            directoriesBefore.sort(),
        );

        await expectNoStagingDirectories();
    });

    it('rolls back installation when the language code already exists', async () => {
        const existingId = nextPluginId();
        const conflictingId = nextPluginId();
        const code = nextLanguageCode();

        await installer.installLanguagePackage(
            createLanguageZip(existingId, code),
        );

        const directoriesBefore = await readdir(storageRoot);

        await expect(
            installer.installLanguagePackage(
                createLanguageZip(conflictingId, code),
            ),
        ).rejects.toBeInstanceOf(ConflictException);

        const conflictingPlugin = await prisma.plugin.findUnique({
            where: { id: conflictingId },
        });

        const language = await prisma.language.findUniqueOrThrow({
            where: { code },
        });

        expect(conflictingPlugin).toBeNull();
        expect(language.pluginId).toBe(existingId);

        const directoriesAfter = await readdir(storageRoot);

        expect(directoriesAfter.sort()).toEqual(
            directoriesBefore.sort(),
        );

        await expectNoStagingDirectories();
    });

    it('rejects an invalid ZIP without creating database records', async () => {
        const pluginCountBefore = await prisma.plugin.count({
            where: {
                id: {
                    in: [...createdPluginIds],
                },
            },
        });

        const directoriesBefore = await readdir(storageRoot);

        await expect(
            installer.installLanguagePackage(
                Buffer.from('not-a-valid-zip'),
            ),
        ).rejects.toThrow();

        const pluginCountAfter = await prisma.plugin.count({
            where: {
                id: {
                    in: [...createdPluginIds],
                },
            },
        });

        expect(pluginCountAfter).toBe(pluginCountBefore);

        const directoriesAfter = await readdir(storageRoot);

        expect(directoriesAfter.sort()).toEqual(
            directoriesBefore.sort(),
        );

        await expectNoStagingDirectories();
    });
});

import {
    CanActivate,
    ExecutionContext,
    INestApplication,
    Injectable,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
import request from 'supertest';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { PrismaService } from '@/prisma/prisma.service';

import { PluginsModule } from '../plugins.module';
import { PLUGIN_STORAGE_ENV_KEY } from '../plugin-storage.config';

@Injectable()
class AllowTestGuard implements CanActivate {
    canActivate(_context: ExecutionContext): boolean {
        return true;
    }
}

interface PluginRecord {
    id: string;
    type: 'LANGUAGE';
    version: string;
    status: 'INSTALLING' | 'INSTALLED' | 'FAILED';
    storagePath: string;
    sourceRepository: null;
}

interface LanguageRecord {
    code: string;
    name: string;
    pluginId: string;
    isBuiltIn: boolean;
    isEnabled: boolean;
    isFallback: boolean;
}

const CRC_TABLE = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
        value =
            value & 1
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

/**
 * Builds a minimal, conventional ZIP archive.
 *
 * The archive uses stored entries, UTF-8 filenames,
 * no extra fields, no descriptors and no comments.
 */
function createZip(
    files: Record<string, string>,
): Buffer {
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
        local.writeUInt32LE(0, 8);
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

    const centralDirectory = Buffer.concat(
        centralRecords,
    );

    const end = Buffer.alloc(22);

    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(
        Object.keys(files).length,
        8,
    );
    end.writeUInt16LE(
        Object.keys(files).length,
        10,
    );
    end.writeUInt32LE(
        centralDirectory.length,
        12,
    );
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([
        ...localRecords,
        centralDirectory,
        end,
    ]);
}

function createLanguageZip(
    id: string,
    languageCode = 'fr',
): Buffer {
    return createZip({
        'manifest.json': JSON.stringify({
            schemaVersion: 1,
            id,
            type: 'language',
            version: '1.0.0',
            language: {
                code: languageCode,
                name: 'French',
                nativeName: 'Français',
            },
            translations: {
                namespace: 'translation',
                path: './locales/fr.json',
            },
        }),
        'locales/fr.json': JSON.stringify({
            common: {
                hello: 'Bonjour',
            },
        }),
    });
}

describe('Plugin installation integration', () => {
    let app: INestApplication;
    let storageRoot: string;
    let previousStorageRoot: string | undefined;

    const records = new Map<string, PluginRecord>();
    const languages = new Map<string, LanguageRecord>();

    const pluginCreate = jest.fn(
        async ({ data }: { data: PluginRecord }) => {
            if (records.has(data.id)) {
                throw { code: 'P2002' };
            }

            const record = { ...data };
            records.set(data.id, record);

            return record;
        },
    );

    const pluginUpdateMany = jest.fn(
        async ({
            where,
            data,
        }: {
            where: Partial<PluginRecord>;
            data: Partial<PluginRecord>;
        }) => {
            const record = records.get(where.id ?? '');

            if (
                !record ||
                Object.entries(where).some(
                    ([key, value]) =>
                        record[key as keyof PluginRecord] !==
                        value,
                )
            ) {
                return { count: 0 };
            }

            Object.assign(record, data);

            return { count: 1 };
        },
    );

    const pluginDeleteMany = jest.fn(
        async ({
            where,
        }: {
            where: Partial<PluginRecord>;
        }) => {
            const record = records.get(where.id ?? '');

            if (
                !record ||
                Object.entries(where).some(
                    ([key, value]) =>
                        record[key as keyof PluginRecord] !==
                        value,
                )
            ) {
                return { count: 0 };
            }

            records.delete(record.id);

            return { count: 1 };
        },
    );

    const languageCreate = jest.fn(
        async ({ data }: { data: LanguageRecord }) => {
            if (
                languages.has(data.code) ||
                Array.from(languages.values()).some(
                    (language) =>
                        language.pluginId === data.pluginId,
                )
            ) {
                throw { code: 'P2002' };
            }

            const record = { ...data };
            languages.set(data.code, record);

            return record;
        },
    );

    const prismaMock = {
        plugin: {
            create: pluginCreate,
            updateMany: pluginUpdateMany,
            deleteMany: pluginDeleteMany,
        },

        language: {
            create: languageCreate,
        },

        $transaction: jest.fn(
            async <T>(
                callback: (
                    tx: {
                        plugin: {
                            updateMany: typeof pluginUpdateMany;
                        };
                        language: {
                            create: typeof languageCreate;
                        };
                    },
                ) => Promise<T>,
            ): Promise<T> => {
                const pluginSnapshot = new Map(
                    Array.from(records.entries()).map(
                        ([id, record]) => [
                            id,
                            { ...record },
                        ] as const,
                    ),
                );

                const languageSnapshot = new Map(
                    Array.from(languages.entries()).map(
                        ([code, record]) => [
                            code,
                            { ...record },
                        ] as const,
                    ),
                );

                try {
                    return await callback({
                        plugin: {
                            updateMany: pluginUpdateMany,
                        },
                        language: {
                            create: languageCreate,
                        },
                    });
                } catch (error) {
                    records.clear();

                    for (const [id, record] of pluginSnapshot) {
                        records.set(id, record);
                    }

                    languages.clear();

                    for (const [code, record] of languageSnapshot) {
                        languages.set(code, record);
                    }

                    throw error;
                }
            },
        ),
    };

    beforeAll(async () => {
        previousStorageRoot =
            process.env[PLUGIN_STORAGE_ENV_KEY];

        storageRoot = await mkdtemp(
            join(tmpdir(), 'tyravex-plugin-http-'),
        );

        process.env[PLUGIN_STORAGE_ENV_KEY] =
            storageRoot;

        const moduleRef = await Test.createTestingModule({
            imports: [PluginsModule],
        })
            .overrideProvider(PrismaService)
            .useValue(prismaMock)
            .overrideGuard(JwtAuthGuard)
            .useClass(AllowTestGuard)
            .overrideGuard(PermissionsGuard)
            .useClass(AllowTestGuard)
            .compile();

        app = moduleRef.createNestApplication({
            logger: false,
        });

        await app.init();
    });

    afterAll(async () => {
        await app?.close();

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
    });

    beforeEach(() => {
        records.clear();
        languages.clear();
        jest.clearAllMocks();
    });

    it('installs a real language ZIP through HTTP', async () => {
        const id = `integration.${randomUUID()}`;
        const archive = createLanguageZip(id);

        const response = await request(
            app.getHttpServer(),
        )
            .post('/admin/plugins/install')
            .set('Content-Type', 'application/zip')
            .send(archive);

        expect(response.status).toBe(201);

        expect(response.body).toEqual({
            id,
            type: 'LANGUAGE',
            version: '1.0.0',
            status: 'INSTALLED',
        });

        const record = records.get(id);

        expect(record).toBeDefined();
        expect(record?.status).toBe('INSTALLED');
        expect(record?.storagePath).toMatch(
            /\/package$/,
        );

        expect(languages.get('fr')).toEqual({
            code: 'fr',
            name: 'French',
            pluginId: id,
            isBuiltIn: false,
            isEnabled: true,
            isFallback: false,
        });

        const packageDirectory = join(
            storageRoot,
            record!.storagePath,
        );

        expect(
            (await stat(packageDirectory)).isDirectory(),
        ).toBe(true);

        const manifest = JSON.parse(
            await readFile(
                join(packageDirectory, 'manifest.json'),
                'utf8',
            ),
        ) as { id: string };

        expect(manifest.id).toBe(id);

        const translation = JSON.parse(
            await readFile(
                join(
                    packageDirectory,
                    'locales',
                    'fr.json',
                ),
                'utf8',
            ),
        ) as { common: { hello: string } };

        expect(translation.common.hello).toBe(
            'Bonjour',
        );

        expect(prismaMock.plugin.create).toHaveBeenCalledTimes(
            1,
        );

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(
            1,
        );

        expect(
            prismaMock.plugin.updateMany,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { status: 'INSTALLED' },
            }),
        );

        expect(prismaMock.language.create).toHaveBeenCalledWith({
            data: {
                code: 'fr',
                name: 'French',
                pluginId: id,
                isBuiltIn: false,
                isEnabled: true,
                isFallback: false,
            },
        });

        const directories = await readdir(
            storageRoot,
        );

        expect(
            directories.some((name) =>
                name.startsWith('.staging-'),
            ),
        ).toBe(false);
    });

    it('rejects an invalid ZIP without creating a record', async () => {
        const response = await request(
            app.getHttpServer(),
        )
            .post('/admin/plugins/install')
            .set('Content-Type', 'application/zip')
            .send(Buffer.from('not-a-zip'));

        expect(response.status).toBe(400);
        expect(records.size).toBe(0);
        expect(languages.size).toBe(0);

        expect(
            prismaMock.plugin.create,
        ).not.toHaveBeenCalled();
    });

    it('returns HTTP 409 for an existing plugin', async () => {
        const id = `integration.${randomUUID()}`;
        const archive = createLanguageZip(id);

        const first = await request(
            app.getHttpServer(),
        )
            .post('/admin/plugins/install')
            .set('Content-Type', 'application/zip')
            .send(archive);

        expect(first.status).toBe(201);

        const second = await request(
            app.getHttpServer(),
        )
            .post('/admin/plugins/install')
            .set('Content-Type', 'application/zip')
            .send(archive);

        expect(second.status).toBe(409);
        expect(records.get(id)?.status).toBe(
            'INSTALLED',
        );
        expect(languages.get('fr')?.pluginId).toBe(id);

        expect(
            prismaMock.plugin.create,
        ).toHaveBeenCalledTimes(2);

        expect(
            prismaMock.language.create,
        ).toHaveBeenCalledTimes(1);

        const directories = await readdir(
            storageRoot,
        );

        expect(
            directories.some((name) =>
                name.startsWith('.staging-'),
            ),
        ).toBe(false);
    });

    it('returns HTTP 409 when the language code is already registered', async () => {
        const existingId = `integration.${randomUUID()}`;
        const conflictingId = `integration.${randomUUID()}`;

        const first = await request(
            app.getHttpServer(),
        )
            .post('/admin/plugins/install')
            .set('Content-Type', 'application/zip')
            .send(createLanguageZip(existingId));

        expect(first.status).toBe(201);

        const second = await request(
            app.getHttpServer(),
        )
            .post('/admin/plugins/install')
            .set('Content-Type', 'application/zip')
            .send(createLanguageZip(conflictingId));

        expect(second.status).toBe(409);

        expect(records.get(existingId)?.status).toBe(
            'INSTALLED',
        );

        expect(records.has(conflictingId)).toBe(false);

        expect(languages.get('fr')?.pluginId).toBe(
            existingId,
        );

        expect(languages.size).toBe(1);

        const directories = await readdir(
            storageRoot,
        );

        expect(
            directories.some((name) =>
                name.startsWith(`${existingId}-`),
            ),
        ).toBe(true);

        expect(
            directories.some((name) =>
                name.startsWith(`${conflictingId}-`),
            ),
        ).toBe(false);

        expect(
            directories.some((name) =>
                name.startsWith('.staging-'),
            ),
        ).toBe(false);
    });
});
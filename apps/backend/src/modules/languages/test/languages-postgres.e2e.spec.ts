import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { LanguagesModule } from '@/modules/languages/languages.module';
import { PrismaService } from '@/prisma/prisma.service';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

import { PLUGIN_STORAGE_ENV_KEY } from
    '@/modules/plugins/storage/plugin-storage.config';

function requireTestDatabaseUrl(value: string | undefined): string {
    if (!value) {
        throw new Error('TEST_DATABASE_URL is required.');
    }

    const url = new URL(value);

    if (
        url.protocol !== 'postgresql:' ||
        url.hostname !== '127.0.0.1' ||
        url.port !== '55433' ||
        url.pathname !== '/tyravex_integration' ||
        url.username !== 'tyravex_test' ||
        url.searchParams.get('schema') !== 'public'
    ) {
        throw new Error(
            'Refusing to run outside the isolated PostgreSQL test database.',
        );
    }

    return value;
}

const databaseUrl = requireTestDatabaseUrl(
    process.env.TEST_DATABASE_URL,
);

const CRC_TABLE = new Uint32Array(256);

for (let index = 0; index < 256; index++) {
    let value = index;

    for (let bit = 0; bit < 8; bit++) {
        value = (value & 1)
            ? 0xedb88320 ^ (value >>> 1)
            : value >>> 1;
    }

    CRC_TABLE[index] = value >>> 0;
}

function crc32(data: Buffer): number {
    let value = 0xffffffff;

    for (const byte of data) {
        value = CRC_TABLE[(value ^ byte) & 0xff] ^
            (value >>> 8);
    }

    return (value ^ 0xffffffff) >>> 0;
}

function createZip(files: Record<string, string>): Buffer {
    const localRecords: Buffer[] = [];
    const centralRecords: Buffer[] = [];

    let offset = 0;

    for (const [filename, content] of Object.entries(files)) {
        const name = Buffer.from(filename, 'utf8');
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

function createLanguageZip(id: string, code: string): Buffer {
    return createZip({
        'manifest.json': JSON.stringify({
            schemaVersion: 1,
            id,
            type: 'language',
            version: '1.0.0',
            language: {
                code,
                name: 'E2E Test Language',
                nativeName: 'E2E Test Language',
            },
            translations: {
                namespace: 'translation',
                path: './locales/translations.json',
            },
        }),
        'locales/translations.json': JSON.stringify({
            common: {
                hello: 'Hello from Tyravex E2E',
            },
        }),
    });
}

describe('Language plugin PostgreSQL HTTP E2E', () => {
    let app: INestApplication | undefined;
    let prisma: PrismaService | undefined;
    let storageRoot: string | undefined;
    let actorId: number | undefined;

    const pluginId = `integration.e2e.${randomUUID()}`;
    const languageCode = `qz-${randomUUID().slice(0, 8)}`;

    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousStorageRoot =
        process.env[PLUGIN_STORAGE_ENV_KEY];

    beforeAll(async () => {
        process.env.DATABASE_URL = databaseUrl;

        storageRoot = await mkdtemp(
            join(tmpdir(), 'tyravex-language-e2e-'),
        );

        process.env[PLUGIN_STORAGE_ENV_KEY] = storageRoot;

        const moduleRef = await Test.createTestingModule({
            imports: [LanguagesModule],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (context: {
                    switchToHttp: () => {
                        getRequest: () => {
                            user?: { id: number };
                        };
                    };
                }) => {
                    const httpRequest = context
                        .switchToHttp()
                        .getRequest();

                    httpRequest.user = {
                        id: actorId!,
                    };

                    return true;
                },
            })
            .overrideGuard(PermissionsGuard)
            .useValue({
                canActivate: () => true,
            })
            .compile();

        app = moduleRef.createNestApplication({
            logger: false,
        });

        prisma = app.get(PrismaService);

        await app.init();

        const actor = await prisma!.user.create({
            data: {
                username: `e2e_${randomUUID().replace(/-/g, '')}`,
                email: `e2e-${randomUUID()}@tyravex.invalid`,
                password: 'integration-test-only',
                isActive: true,
            },
        });

        actorId = actor.id;
    });

    afterAll(async () => {
        try {
            if (prisma) {
                await prisma.adminAuditLog.deleteMany({
                    where: {
                        targetType: 'Plugin',
                        targetId: pluginId,
                    },
                });

                await prisma.language.deleteMany({
                    where: {
                        pluginId,
                        code: languageCode,
                    },
                });

                await prisma.plugin.deleteMany({
                    where: { id: pluginId },
                });

                if (actorId !== undefined) {
                    await prisma.user.delete({
                        where: { id: actorId },
                    });
                }
            }
        } finally {
            try {
                await app?.close();
            } finally {
                if (previousDatabaseUrl === undefined) {
                    delete process.env.DATABASE_URL;
                } else {
                    process.env.DATABASE_URL =
                        previousDatabaseUrl;
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
        }
    });

    it('installs, exposes, disables and re-enables a language through HTTP', async () => {
        const server = app!.getHttpServer();

        const before = await request(server)
            .get('/languages')
            .expect(200);

        expect(
            before.body.some(
                (language: { code: string }) =>
                    language.code === languageCode,
            ),
        ).toBe(false);

        const archive = createLanguageZip(
            pluginId,
            languageCode,
        );

        const installation = await request(server)
            .post('/admin/plugins/install')
            .set('Content-Type', 'application/zip')
            .send(archive)
            .expect(201);

        expect(installation.body).toEqual({
            id: pluginId,
            type: 'LANGUAGE',
            version: '1.0.0',
            status: 'INSTALLED',
        });

        const installedLanguage = await prisma!.language
            .findUniqueOrThrow({
                where: { code: languageCode },
            });

        expect(installedLanguage.pluginId).toBe(pluginId);
        expect(installedLanguage.isEnabled).toBe(true);

        const enabledLanguages = await request(server)
            .get('/languages')
            .expect(200);

        expect(enabledLanguages.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: languageCode,
                    name: 'E2E Test Language',
                }),
            ]),
        );

        const translations = await request(server)
            .get(`/languages/${languageCode}/translations`)
            .expect(200);

        expect(translations.body).toEqual({
            common: {
                hello: 'Hello from Tyravex E2E',
            },
        });

        const disabled = await request(server)
            .post(`/admin/plugins/${pluginId}/disable`)
            .expect(201);

        expect(disabled.body.status).toBe('DISABLED');

        const disabledLanguages = await request(server)
            .get('/languages')
            .expect(200);

        expect(
            disabledLanguages.body.some(
                (language: { code: string }) =>
                    language.code === languageCode,
            ),
        ).toBe(false);

        await request(server)
            .get(`/languages/${languageCode}/translations`)
            .expect(404);

        const disabledRecord = await prisma!.language
            .findUniqueOrThrow({
                where: { code: languageCode },
            });

        expect(disabledRecord.isEnabled).toBe(false);

        const enabled = await request(server)
            .post(`/admin/plugins/${pluginId}/enable`)
            .expect(201);

        expect(enabled.body.status).toBe('INSTALLED');

        const restoredLanguages = await request(server)
            .get('/languages')
            .expect(200);

        expect(
            restoredLanguages.body.some(
                (language: { code: string }) =>
                    language.code === languageCode,
            ),
        ).toBe(true);

        const restoredTranslations = await request(server)
            .get(`/languages/${languageCode}/translations`)
            .expect(200);

        expect(restoredTranslations.body).toEqual({
            common: {
                hello: 'Hello from Tyravex E2E',
            },
        });

        const enabledRecord = await prisma!.language
            .findUniqueOrThrow({
                where: { code: languageCode },
            });

        expect(enabledRecord.isEnabled).toBe(true);

        const auditLogs = await prisma!.adminAuditLog.findMany({
            where: {
                actorId,
                targetType: 'Plugin',
                targetId: pluginId,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        expect(auditLogs.map((log) => log.action).sort())
            .toEqual([
                'plugin.disabled',
                'plugin.enabled',
            ]);

        const storageEntries = await readdir(storageRoot!);

        expect(
            storageEntries.some((name) =>
                name.startsWith('.staging-'),
            ),
        ).toBe(false);
    });
});
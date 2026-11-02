import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import request from 'supertest';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { LanguagesModule } from '@/modules/languages/languages.module';
import { PLUGIN_STORAGE_ENV_KEY } from '@/modules/plugins/storage/plugin-storage.config';
import { PrismaService } from '@/prisma/prisma.service';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

const PLUGIN_ID = 'tyravex.language.german';
const LANGUAGE_CODE = 'de';
const ZIP_NAME = 'tyravex.language.german-1.0.0-fixed.zip';

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

const databaseUrl = requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);

function findRepositoryFile(relativePath: string): string {
    const candidates = [
        resolve(process.cwd(), relativePath),
        resolve(process.cwd(), '../..', relativePath),
    ];

    const found = candidates.find((candidate) => existsSync(candidate));

    if (!found) {
        throw new Error(`Required repository file not found: ${relativePath}`);
    }

    return found;
}

function isTranslationTree(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

describe('German multi-file language plugin PostgreSQL HTTP E2E', () => {
    let app: INestApplication | undefined;
    let prisma: PrismaService | undefined;
    let storageRoot: string | undefined;
    let actorId: number | undefined;
    let ownsPluginRecords = false;

    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousStorageRoot = process.env[PLUGIN_STORAGE_ENV_KEY];

    beforeAll(async () => {
        process.env.DATABASE_URL = databaseUrl;

        storageRoot = await mkdtemp(join(tmpdir(), 'tyravex-german-e2e-'));
        process.env[PLUGIN_STORAGE_ENV_KEY] = storageRoot;

        const moduleRef = await Test.createTestingModule({
            imports: [LanguagesModule],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (context: {
                    switchToHttp: () => {
                        getRequest: () => { user?: { id: number } };
                    };
                }) => {
                    context.switchToHttp().getRequest().user = {
                        id: actorId!,
                    };
                    return true;
                },
            })
            .overrideGuard(PermissionsGuard)
            .useValue({ canActivate: () => true })
            .compile();

        app = moduleRef.createNestApplication({ logger: false });
        prisma = app.get(PrismaService);
        await app.init();

        // Refuse to alter or delete any pre-existing German plugin/language.
        const [existingPlugin, existingLanguage] = await Promise.all([
            prisma!.plugin.findUnique({ where: { id: PLUGIN_ID } }),
            prisma!.language.findUnique({ where: { code: LANGUAGE_CODE } }),
        ]);

        if (existingPlugin || existingLanguage) {
            throw new Error(
                'German plugin or de language already exists in the test database; refusing to modify it.',
            );
        }

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
                if (ownsPluginRecords) {
                    await prisma.adminAuditLog.deleteMany({
                        where: { targetType: 'Plugin', targetId: PLUGIN_ID },
                    });
                    await prisma.language.deleteMany({
                        where: { code: LANGUAGE_CODE, pluginId: PLUGIN_ID },
                    });
                    await prisma.plugin.deleteMany({
                        where: { id: PLUGIN_ID },
                    });
                }

                if (actorId !== undefined) {
                    await prisma.user.delete({ where: { id: actorId } });
                }
            }
        } finally {
            try {
                await app?.close();
            } finally {
                if (previousDatabaseUrl === undefined) {
                    delete process.env.DATABASE_URL;
                } else {
                    process.env.DATABASE_URL = previousDatabaseUrl;
                }

                if (previousStorageRoot === undefined) {
                    delete process.env[PLUGIN_STORAGE_ENV_KEY];
                } else {
                    process.env[PLUGIN_STORAGE_ENV_KEY] = previousStorageRoot;
                }

                if (storageRoot) {
                    await rm(storageRoot, { recursive: true, force: true });
                }
            }
        }
    });

    it('installs German ZIP, serves 19 sections, disables and re-enables via HTTP', async () => {
        const server = app!.getHttpServer();
        const zipPath = findRepositoryFile(`artifacts/${ZIP_NAME}`);
        const archive = await readFile(zipPath);

        const before = await request(server).get('/languages').expect(200);
        expect(
            before.body.some((language: { code: string }) =>
                language.code === LANGUAGE_CODE,
            ),
        ).toBe(false);

        // Only records created after this preflight may be cleaned up.
        ownsPluginRecords = true;

        const installation = await request(server)
            .post('/admin/plugins/install')
            .set('Content-Type', 'application/zip')
            .send(archive)
            .expect(201);

        expect(installation.body).toEqual({
            id: PLUGIN_ID,
            type: 'LANGUAGE',
            version: '1.0.0',
            status: 'INSTALLED',
        });

        const plugin = await prisma!.plugin.findUniqueOrThrow({
            where: { id: PLUGIN_ID },
        });
        const language = await prisma!.language.findUniqueOrThrow({
            where: { code: LANGUAGE_CODE },
        });

        expect(plugin.status).toBe('INSTALLED');
        expect(language.pluginId).toBe(PLUGIN_ID);
        expect(language.isBuiltIn).toBe(false);
        expect(language.isEnabled).toBe(true);

        const manifest = JSON.parse(
            await readFile(join(storageRoot!, plugin.storagePath, 'manifest.json'), 'utf8'),
        ) as { translations: { files: string[] } };
        expect(manifest.translations.files).toHaveLength(19);

        const expected: Record<string, unknown> = {};

        for (const file of manifest.translations.files) {
            expect(file.startsWith('./locales/')).toBe(true);
            expect(file.endsWith('.json')).toBe(true);

            const section = file.slice('./locales/'.length, -'.json'.length);

            const content = JSON.parse(
                await readFile(join(storageRoot!, plugin.storagePath, file.slice(2)), 'utf8'),
            ) as unknown;

            expect(isTranslationTree(content)).toBe(true);

            if (!isTranslationTree(content)) {
                throw new Error(`Invalid German translation section: ${section}`);
            }

            expect(Object.keys(content)).toEqual([section]);

            expected[section] = content[section];
        }

        expect(Object.keys(expected)).toHaveLength(19);

        const enabledLanguages = await request(server)
            .get('/languages')
            .expect(200);
        expect(enabledLanguages.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: LANGUAGE_CODE, name: 'German' }),
            ]),
        );

        const translations = await request(server)
            .get(`/languages/${LANGUAGE_CODE}/translations`)
            .expect(200);
        expect(translations.body).toEqual(expected);

        const disabled = await request(server)
            .post(`/admin/plugins/${PLUGIN_ID}/disable`)
            .expect(201);
        expect(disabled.body.status).toBe('DISABLED');

        const disabledLanguages = await request(server)
            .get('/languages')
            .expect(200);
        expect(
            disabledLanguages.body.some((item: { code: string }) =>
                item.code === LANGUAGE_CODE,
            ),
        ).toBe(false);
        await request(server)
            .get(`/languages/${LANGUAGE_CODE}/translations`)
            .expect(404);

        expect(
            (await prisma!.language.findUniqueOrThrow({
                where: { code: LANGUAGE_CODE },
            })).isEnabled,
        ).toBe(false);

        const enabled = await request(server)
            .post(`/admin/plugins/${PLUGIN_ID}/enable`)
            .expect(201);
        expect(enabled.body.status).toBe('INSTALLED');

        const restoredLanguages = await request(server)
            .get('/languages')
            .expect(200);
        expect(
            restoredLanguages.body.some((item: { code: string }) =>
                item.code === LANGUAGE_CODE,
            ),
        ).toBe(true);

        const restoredTranslations = await request(server)
            .get(`/languages/${LANGUAGE_CODE}/translations`)
            .expect(200);
        expect(restoredTranslations.body).toEqual(expected);

        expect(
            (await prisma!.language.findUniqueOrThrow({
                where: { code: LANGUAGE_CODE },
            })).isEnabled,
        ).toBe(true);

        const auditLogs = await prisma!.adminAuditLog.findMany({
            where: {
                actorId,
                targetType: 'Plugin',
                targetId: PLUGIN_ID,
            },
        });
        expect(auditLogs.map((log) => log.action).sort()).toEqual([
            'plugin.disabled',
            'plugin.enabled',
        ]);

        expect(
            (await readdir(storageRoot!)).some((name) =>
                name.startsWith('.staging-'),
            ),
        ).toBe(false);
    });
});

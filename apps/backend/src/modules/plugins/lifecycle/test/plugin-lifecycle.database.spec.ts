import { ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PluginLifecycleService } from '../plugin-lifecycle.service';

const TEST_DATABASE_NAME = 'tyravex_integration';
const TEST_DATABASE_PORT = '55433';
const TEST_DATABASE_HOSTS = ['127.0.0.1', 'localhost'];

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

function validateTestDatabaseUrl(value: string | undefined): string {
    if (!value) {
        throw new Error(
            'TEST_DATABASE_URL is required for database integration tests.',
        );
    }

    let url: URL;

    try {
        url = new URL(value);
    } catch {
        throw new Error('TEST_DATABASE_URL is not a valid URL.');
    }

    if (
        !['postgresql:', 'postgres:'].includes(url.protocol) ||
        !TEST_DATABASE_HOSTS.includes(url.hostname) ||
        url.port !== TEST_DATABASE_PORT ||
        url.pathname !== `/${TEST_DATABASE_NAME}` ||
        url.username !== 'tyravex_test'
    ) {
        throw new Error(
            'Refusing to run tests outside the isolated Tyravex integration database.',
        );
    }

    return value;
}

const safeDatabaseUrl = validateTestDatabaseUrl(testDatabaseUrl);

// PrismaService reads DATABASE_URL when it is constructed.
// Override it only inside this Jest process.
process.env.DATABASE_URL = safeDatabaseUrl;

describe('Plugin lifecycle PostgreSQL integration', () => {
    let prisma: PrismaService;
    let lifecycle: PluginLifecycleService;

    const pluginId = 'tyravex.integration.lifecycle';
    const languageCode = 'x-tvx-lifecycle';
    const missingLanguagePluginId = 'tyravex.integration.missing-language';
    const duplicatePluginId = 'tyravex.integration.duplicate-language';
    const duplicateLanguageCode = 'x-tvx-duplicate';

    let actorId: number;

    async function createPlugin(
        id: string,
        status: 'INSTALLED' | 'DISABLED' = 'INSTALLED',
    ) {
        return prisma.plugin.create({
            data: {
                id,
                type: 'LANGUAGE',
                version: '1.0.0',
                status,
                storagePath: `integration-tests/${id}`,
            },
        });
    }

    async function createLanguage(
        code: string,
        id: string,
        isEnabled = true,
    ) {
        return prisma.language.create({
            data: {
                code,
                name: `Integration test ${code}`,
                pluginId: id,
                isBuiltIn: false,
                isEnabled,
                isFallback: false,
            },
        });
    }

    async function removeTestRecords() {
        await prisma.adminAuditLog.deleteMany({
            where: {
                targetType: 'Plugin',
                targetId: {
                    in: [
                        pluginId,
                        missingLanguagePluginId,
                        duplicatePluginId,
                    ],
                },
            },
        });

        await prisma.language.deleteMany({
            where: {
                code: {
                    in: [languageCode, duplicateLanguageCode],
                },
            },
        });

        await prisma.plugin.deleteMany({
            where: {
                id: {
                    in: [
                        pluginId,
                        missingLanguagePluginId,
                        duplicatePluginId,
                    ],
                },
            },
        });
    }

    beforeAll(async () => {
        prisma = new PrismaService();
        lifecycle = new PluginLifecycleService(prisma);

        await prisma.$connect();

        // This user exists only in the isolated integration database.
        const actor = await prisma.user.create({
            data: {
                username: 'integration_plugin_lifecycle_actor',
                email: 'integration-plugin-lifecycle@tyravex.invalid',
                password: 'integration-test-not-a-real-password',
                isActive: true,
            },
        });

        actorId = actor.id;
    });

    beforeEach(async () => {
        await removeTestRecords();
    });

    afterAll(async () => {
        if (!prisma) {
            return;
        }

        try {
            await removeTestRecords();

            await prisma.user.deleteMany({
                where: {
                    username: 'integration_plugin_lifecycle_actor',
                },
            });
        } finally {
            await prisma.$disconnect();
        }
    });

    it('disables a language plugin and its language atomically', async () => {
        await createPlugin(pluginId);
        await createLanguage(languageCode, pluginId);

        await lifecycle.disable(pluginId, actorId);

        const plugin = await prisma.plugin.findUniqueOrThrow({
            where: { id: pluginId },
        });

        const language = await prisma.language.findUniqueOrThrow({
            where: { code: languageCode },
        });

        const audit = await prisma.adminAuditLog.findFirst({
            where: {
                actorId,
                action: 'plugin.disabled',
                targetType: 'Plugin',
                targetId: pluginId,
            },
        });

        expect(plugin.status).toBe('DISABLED');
        expect(language.isEnabled).toBe(false);
        expect(audit).not.toBeNull();
    });

    it('re-enables a language plugin and its language atomically', async () => {
        await createPlugin(pluginId, 'DISABLED');
        await createLanguage(languageCode, pluginId, false);

        await lifecycle.enable(pluginId, actorId);

        const plugin = await prisma.plugin.findUniqueOrThrow({
            where: { id: pluginId },
        });

        const language = await prisma.language.findUniqueOrThrow({
            where: { code: languageCode },
        });

        const audit = await prisma.adminAuditLog.findFirst({
            where: {
                actorId,
                action: 'plugin.enabled',
                targetType: 'Plugin',
                targetId: pluginId,
            },
        });

        expect(plugin.status).toBe('INSTALLED');
        expect(language.isEnabled).toBe(true);
        expect(audit).not.toBeNull();
    });

    it('rolls back plugin status when its language registration is missing', async () => {
        await createPlugin(missingLanguagePluginId);

        await expect(
            lifecycle.disable(missingLanguagePluginId, actorId),
        ).rejects.toBeInstanceOf(ConflictException);

        const plugin = await prisma.plugin.findUniqueOrThrow({
            where: { id: missingLanguagePluginId },
        });

        const auditCount = await prisma.adminAuditLog.count({
            where: {
                actorId,
                targetType: 'Plugin',
                targetId: missingLanguagePluginId,
            },
        });

        expect(plugin.status).toBe('INSTALLED');
        expect(auditCount).toBe(0);
    });

    it('enforces unique language codes in PostgreSQL', async () => {
        await createPlugin(pluginId);
        await createPlugin(duplicatePluginId);

        await createLanguage(duplicateLanguageCode, pluginId);

        await expect(
            createLanguage(duplicateLanguageCode, duplicatePluginId),
        ).rejects.toMatchObject({
            code: 'P2002',
        });

        const languages = await prisma.language.findMany({
            where: { code: duplicateLanguageCode },
        });

        expect(languages).toHaveLength(1);
        expect(languages[0].pluginId).toBe(pluginId);
    });

    it('rolls back a transaction after a language code conflict', async () => {
        await createPlugin(pluginId);
        await createPlugin(duplicatePluginId, 'DISABLED');

        await createLanguage(duplicateLanguageCode, pluginId);

        await expect(
            prisma.$transaction(async (tx) => {
                await tx.plugin.update({
                    where: { id: duplicatePluginId },
                    data: { status: 'INSTALLED' },
                });

                await tx.language.create({
                    data: {
                        code: duplicateLanguageCode,
                        name: 'Duplicate language',
                        pluginId: duplicatePluginId,
                        isBuiltIn: false,
                        isEnabled: true,
                    },
                });
            }),
        ).rejects.toMatchObject({
            code: 'P2002',
        });

        const plugin = await prisma.plugin.findUniqueOrThrow({
            where: { id: duplicatePluginId },
        });

        const languageCount = await prisma.language.count({
            where: { code: duplicateLanguageCode },
        });

        expect(plugin.status).toBe('DISABLED');
        expect(languageCount).toBe(1);
    });
});
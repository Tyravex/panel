import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';

import { PluginInstallerService } from '../plugin-installer.service';
import { PLUGIN_STORAGE_ENV_KEY } from '../plugin-storage.config';
import { inspectPluginZip } from '../plugin-zip-reader';

function validateTestDatabaseUrl(value: string | undefined): string {
    if (!value) {
        throw new Error('TEST_DATABASE_URL is required for database integration tests.');
    }

    const url = new URL(value);
    if (
        url.protocol !== 'postgresql:' ||
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        url.port !== '55433' ||
        url.pathname !== '/tyravex_integration' ||
        url.username !== 'tyravex_test' ||
        url.searchParams.get('schema') !== 'public'
    ) {
        throw new Error('Refusing to use a database outside the isolated Tyravex test environment.');
    }

    return value;
}

const safeDatabaseUrl = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const pluginId = 'tyravex.language.german';
const languageCode = 'de';
const archivePath = resolve(
    __dirname,
    '../../../../../../artifacts/tyravex.language.german-1.0.0-fixed.zip',
);

describe('German multi-file language plugin PostgreSQL integration', () => {
    let prisma: PrismaService;
    let installer: PluginInstallerService;
    let storageRoot: string | undefined;
    let installedByThisTest = false;

    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousStorageRoot = process.env[PLUGIN_STORAGE_ENV_KEY];

    beforeAll(async () => {
        process.env.DATABASE_URL = safeDatabaseUrl;
        storageRoot = await mkdtemp(join(tmpdir(), `tyravex-german-db-${randomUUID()}-`));
        process.env[PLUGIN_STORAGE_ENV_KEY] = storageRoot;
        prisma = new PrismaService();
        installer = new PluginInstallerService(prisma);
        await prisma.$connect();
    });

    afterAll(async () => {
        try {
            if (prisma) {
                try {
                    if (installedByThisTest) {
                        await prisma.language.deleteMany({
                            where: { code: languageCode, pluginId },
                        });
                        await prisma.plugin.deleteMany({
                            where: { id: pluginId },
                        });
                    }
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
                process.env[PLUGIN_STORAGE_ENV_KEY] = previousStorageRoot;
            }
            if (storageRoot) {
                await rm(storageRoot, { recursive: true, force: true });
            }
        }
    });

    it('installs the actual German ZIP with 19 translation files', async () => {
        const existingPlugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
        const existingLanguage = await prisma.language.findUnique({ where: { code: languageCode } });
        if (existingPlugin || existingLanguage) {
            throw new Error('German plugin or language already exists in test DB; refusing to modify it.');
        }

        const archive = await readFile(archivePath);
        const inspected = await inspectPluginZip(archive);
        expect(inspected.manifest.id).toBe(pluginId);
        expect(inspected.manifest.language.code).toBe(languageCode);
        expect(inspected.manifest.translations).toMatchObject({
            namespace: 'translation',
            files: expect.arrayContaining([
                './locales/sidebar.json',
                './locales/common.json',
            ]),
        });
        expect(inspected.entries.filter((entry) => entry.kind === 'file')).toHaveLength(20);

        const result = await installer.installLanguagePackage(archive);
        installedByThisTest = true;
        expect(result).toEqual({
            id: pluginId,
            type: 'LANGUAGE',
            version: '1.0.0',
            status: 'INSTALLED',
        });

        const plugin = await prisma.plugin.findUniqueOrThrow({ where: { id: pluginId } });
        const language = await prisma.language.findUniqueOrThrow({ where: { code: languageCode } });
        expect(plugin.status).toBe('INSTALLED');
        expect(plugin.type).toBe('LANGUAGE');
        expect(language.pluginId).toBe(pluginId);
        expect(language.isBuiltIn).toBe(false);
        expect(language.isEnabled).toBe(true);

        if (!storageRoot) throw new Error('Missing isolated plugin storage root.');
        if (isAbsolute(plugin.storagePath)) throw new Error('Unexpected absolute plugin storage path.');
        const packageDirectory = join(storageRoot, plugin.storagePath);
        expect((await stat(packageDirectory)).isDirectory()).toBe(true);

        const storedManifest = JSON.parse(
            await readFile(join(packageDirectory, 'manifest.json'), 'utf8'),
        ) as { id: string; translations: { files: string[] } };
        expect(storedManifest.id).toBe(pluginId);
        expect(storedManifest.translations.files).toHaveLength(19);
        for (const relativePath of storedManifest.translations.files) {
            const filePath = join(packageDirectory, relativePath.slice(2));
            const resource = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
            expect(Object.keys(resource)).toHaveLength(1);
        }
        expect((await readdir(storageRoot)).filter((name) => name.startsWith('.staging-'))).toEqual([]);
    });
});

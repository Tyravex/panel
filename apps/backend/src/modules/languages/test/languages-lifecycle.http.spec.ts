import {
    ConflictException,
    INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { PrismaService } from '@/prisma/prisma.service';
import { PluginsService } from '@/modules/plugins/plugins.service';
import { PluginLifecycleService } from '@/modules/plugins/lifecycle/plugin-lifecycle.service';

import { LanguagesController } from '../languages.controller';
import { LanguagesService } from '../languages.service';

jest.mock(
    '@/modules/plugins/languages/language-plugin-loader',
    () => ({
        loadLanguagePlugin: jest.fn(),
    }),
);

import { loadLanguagePlugin } from
    '@/modules/plugins/languages/language-plugin-loader';

const loaderMock = jest.mocked(loadLanguagePlugin);

describe('Language lifecycle HTTP integration', () => {
    const pluginId = 'integration.language';
    const languageCode = 'fr';

    type PluginStatus =
        | 'INSTALLED'
        | 'DISABLED'
        | 'FAILED';

    interface PluginState {
        id: string;
        type: string;
        version: string;
        status: PluginStatus;
        storagePath: string;
    }

    interface LanguageState {
        code: string;
        name: string;
        pluginId: string | null;
        isBuiltIn: boolean;
        isEnabled: boolean;
    }

    let app: INestApplication;
    let plugin: PluginState;
    let language: LanguageState | null;

    const prisma = {
        plugin: {
            findUnique: jest.fn(),
            findUniqueOrThrow: jest.fn(),
            updateMany: jest.fn(),
            findFirst: jest.fn(),
        },
        language: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            updateMany: jest.fn(),
        },
        adminAuditLog: {
            create: jest.fn(),
        },
        $transaction: jest.fn(),
    };

    const publicLanguageIsAvailable = () =>
        language !== null &&
        language.isEnabled &&
        (
            language.isBuiltIn ||
            (
                language.pluginId === plugin.id &&
                plugin.type === 'LANGUAGE' &&
                plugin.status === 'INSTALLED'
            )
        );

    beforeEach(async () => {
        jest.resetAllMocks();

        plugin = {
            id: pluginId,
            type: 'LANGUAGE',
            version: '1.0.0',
            status: 'INSTALLED',
            storagePath: 'integration-language/package',
        };

        language = {
            code: languageCode,
            name: 'French',
            pluginId,
            isBuiltIn: false,
            isEnabled: true,
        };

        prisma.plugin.findUnique.mockImplementation(
            async ({ where }: { where: { id: string } }) =>
                where.id === plugin.id
                    ? { ...plugin }
                    : null,
        );

        prisma.plugin.findUniqueOrThrow.mockImplementation(
            async () => ({ ...plugin }),
        );

        prisma.plugin.findFirst.mockImplementation(
            async ({
                where,
            }: {
                where: {
                    id: string;
                    type: string;
                    status: string;
                };
            }) =>
                plugin.id === where.id &&
                    plugin.type === where.type &&
                    plugin.status === where.status
                    ? { ...plugin }
                    : null,
        );

        prisma.plugin.updateMany.mockImplementation(
            async ({
                where,
                data,
            }: {
                where: {
                    id: string;
                    status: PluginStatus;
                };
                data: {
                    status: PluginStatus;
                };
            }) => {
                if (
                    plugin.id !== where.id ||
                    plugin.status !== where.status
                ) {
                    return { count: 0 };
                }

                plugin.status = data.status;
                return { count: 1 };
            },
        );

        prisma.language.findMany.mockImplementation(
            async () =>
                publicLanguageIsAvailable() && language
                    ? [{
                        code: language.code,
                        name: language.name,
                    }]
                    : [],
        );

        prisma.language.findFirst.mockImplementation(
            async ({
                where,
            }: {
                where: {
                    code: string;
                };
            }) =>
                publicLanguageIsAvailable() &&
                    language?.code === where.code
                    ? {
                        code: language.code,
                        pluginId: language.pluginId,
                    }
                    : null,
        );

        prisma.language.updateMany.mockImplementation(
            async ({
                where,
                data,
            }: {
                where: {
                    pluginId: string;
                    isBuiltIn: boolean;
                };
                data: {
                    isEnabled: boolean;
                };
            }) => {
                if (
                    !language ||
                    language.pluginId !== where.pluginId ||
                    language.isBuiltIn !== where.isBuiltIn
                ) {
                    return { count: 0 };
                }

                language.isEnabled = data.isEnabled;
                return { count: 1 };
            },
        );

        prisma.adminAuditLog.create.mockResolvedValue({});

        prisma.$transaction.mockImplementation(
            async (
                callback: (
                    tx: typeof prisma,
                ) => Promise<unknown>,
            ) => {
                const pluginSnapshot = { ...plugin };
                const languageSnapshot = language
                    ? { ...language }
                    : null;

                try {
                    return await callback(prisma);
                } catch (error) {
                    plugin = pluginSnapshot;
                    language = languageSnapshot;
                    throw error;
                }
            },
        );

        loaderMock.mockResolvedValue({
            manifest: {
                schemaVersion: 1,
                id: pluginId,
                type: 'language',
                version: '1.0.0',
                language: {
                    code: languageCode,
                    name: 'French',
                    nativeName: 'Français',
                },
                translations: {
                    namespace: 'translation',
                    path: './translations/fr.json',
                },
            },
            translations: {
                greeting: 'Bonjour',
            },
        } as Awaited<ReturnType<typeof loadLanguagePlugin>>);

        const moduleRef = await Test.createTestingModule({
            controllers: [LanguagesController],
            providers: [
                LanguagesService,
                PluginsService,
                PluginLifecycleService,
                {
                    provide: PrismaService,
                    useValue: prisma,
                },
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        await app.init();
    });

    afterEach(async () => {
        await app?.close();
    });

    it('exposes an installed language through HTTP', async () => {
        const response = await request(app.getHttpServer())
            .get('/languages')
            .expect(200);

        expect(response.body).toEqual([
            {
                code: languageCode,
                name: 'French',
            },
        ]);
    });

    it('serves translations for an enabled language', async () => {
        const response = await request(app.getHttpServer())
            .get(`/languages/${languageCode}/translations`)
            .expect(200);

        expect(response.body).toEqual({
            greeting: 'Bonjour',
        });

        expect(loaderMock).toHaveBeenCalledTimes(1);
    });

    it('hides a language after disabling its plugin', async () => {
        const lifecycle = app.get(PluginLifecycleService);

        await lifecycle.disable(pluginId, 1);

        expect(plugin.status).toBe('DISABLED');
        expect(language?.isEnabled).toBe(false);

        const response = await request(app.getHttpServer())
            .get('/languages')
            .expect(200);

        expect(response.body).toEqual([]);
    });

    it('returns 404 for translations of a disabled language', async () => {
        const lifecycle = app.get(PluginLifecycleService);

        await lifecycle.disable(pluginId, 1);

        await request(app.getHttpServer())
            .get(`/languages/${languageCode}/translations`)
            .expect(404);

        expect(loaderMock).not.toHaveBeenCalled();
    });

    it('restores language availability after enabling the plugin', async () => {
        const lifecycle = app.get(PluginLifecycleService);

        await lifecycle.disable(pluginId, 1);
        await lifecycle.enable(pluginId, 1);

        expect(plugin.status).toBe('INSTALLED');
        expect(language?.isEnabled).toBe(true);

        const listResponse = await request(app.getHttpServer())
            .get('/languages')
            .expect(200);

        expect(listResponse.body).toEqual([
            {
                code: languageCode,
                name: 'French',
            },
        ]);

        const translationResponse = await request(
            app.getHttpServer(),
        )
            .get(`/languages/${languageCode}/translations`)
            .expect(200);

        expect(translationResponse.body).toEqual({
            greeting: 'Bonjour',
        });
    });

    it('rejects lifecycle changes when the language record is missing', async () => {
        const lifecycle = app.get(PluginLifecycleService);

        language = null;

        await expect(
            lifecycle.disable(pluginId, 1),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(plugin.status).toBe('INSTALLED');

        expect(
            prisma.adminAuditLog.create,
        ).not.toHaveBeenCalled();

        await request(app.getHttpServer())
            .get('/languages')
            .expect(200, []);

        await request(app.getHttpServer())
            .get(`/languages/${languageCode}/translations`)
            .expect(404);
    });

    it('hides a language when plugin status is inconsistent', async () => {
        plugin.status = 'FAILED';

        await request(app.getHttpServer())
            .get('/languages')
            .expect(200, []);

        await request(app.getHttpServer())
            .get(`/languages/${languageCode}/translations`)
            .expect(404);

        expect(loaderMock).not.toHaveBeenCalled();
    });
});
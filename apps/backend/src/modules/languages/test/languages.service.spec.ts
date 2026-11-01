import { PrismaService } from '@/prisma/prisma.service';

import { LanguagesService } from '../languages.service';

describe('LanguagesService', () => {
    const prisma = {
        language: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
        },
    };

    let service: LanguagesService;

    beforeEach(() => {
        jest.resetAllMocks();

        prisma.language.findMany.mockResolvedValue([]);
        prisma.language.findFirst.mockResolvedValue(null);

        service = new LanguagesService(
            prisma as unknown as PrismaService,
        );
    });

    it('lists enabled built-in and installed plugin languages', async () => {
        const languages = [
            { code: 'en', name: 'English' },
            { code: 'fr', name: 'French' },
        ];

        prisma.language.findMany.mockResolvedValue(
            languages,
        );

        const result = await service.findEnabled();

        expect(result).toEqual(languages);

        expect(prisma.language.findMany).toHaveBeenCalledWith({
            where: {
                isEnabled: true,
                OR: [
                    {
                        isBuiltIn: true,
                    },
                    {
                        isBuiltIn: false,
                        plugin: {
                            is: {
                                type: 'LANGUAGE',
                                status: 'INSTALLED',
                            },
                        },
                    },
                ],
            },
            select: {
                code: true,
                name: true,
            },
            orderBy: {
                code: 'asc',
            },
        });
    });

    it('requires an installed plugin for plugin language lookup', async () => {
        const language = {
            code: 'fr',
            name: 'French',
            pluginId: 'example.language',
        };

        prisma.language.findFirst.mockResolvedValue(
            language,
        );

        const result =
            await service.findEnabledPluginLanguage('fr');

        expect(result).toEqual(language);

        expect(prisma.language.findFirst).toHaveBeenCalledWith({
            where: {
                code: 'fr',
                isEnabled: true,
                isBuiltIn: false,
                pluginId: {
                    not: null,
                },
                plugin: {
                    is: {
                        type: 'LANGUAGE',
                        status: 'INSTALLED',
                    },
                },
            },
            select: {
                code: true,
                name: true,
                pluginId: true,
            },
        });
    });

    it('returns null when no enabled plugin language matches', async () => {
        const result =
            await service.findEnabledPluginLanguage('fr');

        expect(result).toBeNull();
    });

    it('does not return plugin language metadata in the public list', async () => {
        await service.findEnabled();

        expect(prisma.language.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                select: {
                    code: true,
                    name: true,
                },
            }),
        );
    });
});
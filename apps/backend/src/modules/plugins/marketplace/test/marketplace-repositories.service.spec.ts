import {
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';

import { MarketplaceRepositoriesService } from '../marketplace-repositories.service';

describe('MarketplaceRepositoriesService', () => {
    const repository = {
        id: 'repo-1',
        name: 'Community Plugins',
        url: 'https://plugins.example.org/registry.json',
        isOfficial: false,
        status: 'DISABLED' as const,
        createdAt: new Date('2026-11-01T12:00:00.000Z'),
        updatedAt: new Date('2026-11-01T12:00:00.000Z'),
    };

    let service: MarketplaceRepositoriesService;

    const prisma = {
        pluginRepository: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            deleteMany: jest.fn(),
        },
    };

    beforeEach(() => {
        jest.resetAllMocks();

        service = new MarketplaceRepositoriesService(
            prisma as unknown as PrismaService,
        );
    });

    describe('list', () => {
        it('lists repositories with serialized dates', async () => {
            prisma.pluginRepository.findMany.mockResolvedValue([
                repository,
            ]);

            await expect(service.list()).resolves.toEqual({
                repositories: [
                    {
                        id: 'official',
                        name: 'Tyravex Official',
                        url: 'https://raw.githubusercontent.com/Tyravex/tyravex-plugins/main/registry.json',
                        isOfficial: true,
                        status: 'ENABLED',
                        createdAt: '2026-01-01T00:00:00.000Z',
                        updatedAt: '2026-01-01T00:00:00.000Z',
                    },
                    {
                        ...repository,
                        createdAt: '2026-11-01T12:00:00.000Z',
                        updatedAt: '2026-11-01T12:00:00.000Z',
                    },
                ],
            });
        });
    });

    describe('getById', () => {
        it('returns repository details with serialized dates', async () => {
            prisma.pluginRepository.findUnique.mockResolvedValue(repository);

            await expect(service.getById('repo-1')).resolves.toEqual({
                ...repository,
                createdAt: '2026-11-01T12:00:00.000Z',
                updatedAt: '2026-11-01T12:00:00.000Z',
            });

            expect(
                prisma.pluginRepository.findUnique,
            ).toHaveBeenCalledWith({
                where: { id: 'repo-1' },
            });
        });

        it('returns 404 when repository does not exist', async () => {
            prisma.pluginRepository.findUnique.mockResolvedValue(null);

            await expect(
                service.getById('missing'),
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('allows reading an official repository', async () => {
            prisma.pluginRepository.findUnique.mockResolvedValue({
                ...repository,
                isOfficial: true,
            });

            const result = await service.getById('repo-1');

            expect(result.isOfficial).toBe(true);
        });
    });

    describe('create', () => {
        it('creates a disabled community repository', async () => {
            prisma.pluginRepository.findUnique.mockResolvedValue(null);
            prisma.pluginRepository.create.mockResolvedValue(repository);

            const result = await service.create({
                name: 'Community Plugins',
                url: 'https://plugins.example.org/registry.json',
            });

            expect(result.status).toBe('DISABLED');
            expect(result.isOfficial).toBe(false);

            expect(prisma.pluginRepository.create).toHaveBeenCalledWith({
                data: {
                    name: 'Community Plugins',
                    url: 'https://plugins.example.org/registry.json',
                    isOfficial: false,
                    status: 'DISABLED',
                },
            });
        });

        it('rejects duplicate repositories', async () => {
            prisma.pluginRepository.findUnique.mockResolvedValue(
                repository,
            );

            await expect(
                service.create({
                    name: 'Duplicate',
                    url: repository.url,
                }),
            ).rejects.toBeInstanceOf(ConflictException);

            expect(prisma.pluginRepository.create).not.toHaveBeenCalled();
        });

        it('rejects the official registry URL', async () => {
            await expect(
                service.create({
                    name: 'Official',
                    url: 'https://raw.githubusercontent.com/Tyravex/tyravex-plugins/main/registry.json',
                }),
            ).rejects.toBeInstanceOf(ConflictException);
        });

        it.each([
            'http://plugins.example.org/registry.json',
            'https://localhost/registry.json',
            'https://127.0.0.1/registry.json',
            'https://192.168.1.10/registry.json',
            'https://user:pass@plugins.example.org/registry.json',
            'https://plugins.example.org:8443/registry.json',
        ])(
            'rejects an unsafe repository URL: %s',
            async (url) => {
                await expect(
                    service.create({
                        name: 'Unsafe',
                        url,
                    }),
                ).rejects.toBeInstanceOf(BadRequestException);
            },
        );
    });

    describe('update', () => {
        it('rejects editing an official repository', async () => {
            prisma.pluginRepository.findUnique.mockResolvedValue({
                ...repository,
                isOfficial: true,
            });

            await expect(
                service.update(repository.id, {
                    status: 'DISABLED',
                }),
            ).rejects.toBeInstanceOf(BadRequestException);

            expect(
                prisma.pluginRepository.updateMany,
            ).not.toHaveBeenCalled();
        });

        it('updates a community repository status', async () => {
            prisma.pluginRepository.updateMany.mockResolvedValue({
                count: 1,
            });

            prisma.pluginRepository.findUnique
                .mockResolvedValueOnce(repository)
                .mockResolvedValueOnce({
                    ...repository,
                    status: 'ENABLED',
                });

            const result = await service.update(repository.id, {
                status: 'ENABLED',
            });

            expect(result.status).toBe('ENABLED');

            expect(
                prisma.pluginRepository.updateMany,
            ).toHaveBeenCalledWith({
                where: {
                    id: repository.id,
                    isOfficial: false,
                },
                data: {
                    status: 'ENABLED',
                },
            });
        });

        it('returns not found for an unknown repository', async () => {
            prisma.pluginRepository.findUnique.mockResolvedValue(null);

            await expect(
                service.update('missing', {
                    status: 'ENABLED',
                }),
            ).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe('remove', () => {
        it('deletes a community repository', async () => {
            prisma.pluginRepository.findUnique.mockResolvedValue({
                ...repository,
                isOfficial: false,
            });

            prisma.pluginRepository.deleteMany.mockResolvedValue({
                count: 1,
            });

            await expect(
                service.remove('repo-1'),
            ).resolves.toBeUndefined();

            expect(
                prisma.pluginRepository.deleteMany,
            ).toHaveBeenCalledWith({
                where: {
                    id: 'repo-1',
                    isOfficial: false,
                },
            });
        });

        it('rejects deleting an official repository', async () => {
            prisma.pluginRepository.findUnique.mockResolvedValue({
                ...repository,
                id: 'official',
                isOfficial: true,
            });

            await expect(
                service.remove('official'),
            ).rejects.toBeInstanceOf(BadRequestException);

            expect(
                prisma.pluginRepository.deleteMany,
            ).not.toHaveBeenCalled();
        });

        it('returns 404 when repository does not exist', async () => {
            prisma.pluginRepository.findUnique.mockResolvedValue(null);

            await expect(
                service.remove('missing'),
            ).rejects.toBeInstanceOf(NotFoundException);

            expect(
                prisma.pluginRepository.deleteMany,
            ).not.toHaveBeenCalled();
        });

        it('rejects deletion when no rows are deleted', async () => {
            prisma.pluginRepository.findUnique.mockResolvedValue({
                ...repository,
                isOfficial: false,
            });

            prisma.pluginRepository.deleteMany.mockResolvedValue({
                count: 0,
            });

            await expect(
                service.remove('repo-1'),
            ).rejects.toBeInstanceOf(ConflictException);
        });
    });
});
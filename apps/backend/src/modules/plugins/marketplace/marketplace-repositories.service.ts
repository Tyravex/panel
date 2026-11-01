import { Prisma } from '@prisma/client';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import type {
    CreateMarketplaceRepositoryRequest,
    MarketplaceRepository,
    MarketplaceRepositoriesResponse,
    UpdateMarketplaceRepositoryRequest,
} from '@shared/types';

import { PrismaService } from '@/prisma/prisma.service';

const OFFICIAL_REGISTRY_URL =
    'https://raw.githubusercontent.com/Tyravex/tyravex-plugins/main/registry.json';

const OFFICIAL_REPOSITORY_ID = 'official';
const OFFICIAL_REPOSITORY_NAME = 'Tyravex Official';

// Technical placeholder dates for the virtual repository.
// These are not actual repository creation/update dates.
const OFFICIAL_REPOSITORY_DATE = '2026-01-01T00:00:00.000Z';

function getOfficialRepository(): MarketplaceRepository {
    return {
        id: OFFICIAL_REPOSITORY_ID,
        name: OFFICIAL_REPOSITORY_NAME,
        url: OFFICIAL_REGISTRY_URL,
        isOfficial: true,
        status: 'ENABLED',
        createdAt: OFFICIAL_REPOSITORY_DATE,
        updatedAt: OFFICIAL_REPOSITORY_DATE,
    };
}

function normalizeRepositoryUrl(value: string): string {
    let url: URL;

    try {
        url = new URL(value);
    } catch {
        throw new BadRequestException('Invalid repository URL.');
    }

    if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.port ||
        !url.hostname.includes('.')
    ) {
        throw new BadRequestException(
            'Repository URL must be a public HTTPS URL without credentials, query, fragment or custom port.',
        );
    }

    const hostname = url.hostname.toLowerCase();

    if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.test') ||
        hostname.endsWith('.invalid') ||
        hostname.endsWith('.example') ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '[::1]' ||
        /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
        hostname.startsWith('[')
    ) {
        throw new BadRequestException(
            'Repository URL must use a public DNS hostname.',
        );
    }

    return url.toString();
}

@Injectable()
export class MarketplaceRepositoriesService {
    constructor(private readonly prisma: PrismaService) { }

    async list(): Promise<MarketplaceRepositoriesResponse> {
        const repositories = await this.prisma.pluginRepository.findMany({
            orderBy: [
                { isOfficial: 'desc' },
                { name: 'asc' },
            ],
        });

        return {
            repositories: [
                getOfficialRepository(),
                ...repositories
                    .filter(
                        (repository) =>
                            !repository.isOfficial &&
                            repository.url !== OFFICIAL_REGISTRY_URL,
                    )
                    .map((repository) => ({
                        id: repository.id,
                        name: repository.name,
                        url: repository.url,
                        isOfficial: repository.isOfficial,
                        status: repository.status,
                        createdAt: repository.createdAt.toISOString(),
                        updatedAt: repository.updatedAt.toISOString(),
                    })),
            ],
        };
    }

    async getById(id: string): Promise<MarketplaceRepository> {
        if (id === OFFICIAL_REPOSITORY_ID) {
            return getOfficialRepository();
        }

        const repository = await this.prisma.pluginRepository.findUnique({
            where: { id },
        });

        if (!repository) {
            throw new NotFoundException('Repository not found.');
        }

        return {
            id: repository.id,
            name: repository.name,
            url: repository.url,
            isOfficial: repository.isOfficial,
            status: repository.status,
            createdAt: repository.createdAt.toISOString(),
            updatedAt: repository.updatedAt.toISOString(),
        };
    }

    async create(
        input: CreateMarketplaceRepositoryRequest,
    ): Promise<MarketplaceRepository> {
        const name = input.name.trim();
        const url = normalizeRepositoryUrl(input.url);

        if (url === OFFICIAL_REGISTRY_URL) {
            throw new ConflictException(
                'The official Tyravex repository is managed by the system.',
            );
        }

        const existing = await this.prisma.pluginRepository.findUnique({
            where: { url },
        });

        if (existing) {
            throw new ConflictException(
                'This repository has already been added.',
            );
        }

        // Community repositories are disabled until explicitly enabled.
        let repository;

        try {
            repository = await this.prisma.pluginRepository.create({
                data: {
                    name,
                    url,
                    isOfficial: false,
                    status: 'DISABLED',
                },
            });
        } catch (error: unknown) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new ConflictException(
                    'This repository has already been added.',
                );
            }

            throw error;
        }

        return {
            id: repository.id,
            name: repository.name,
            url: repository.url,
            isOfficial: repository.isOfficial,
            status: repository.status,
            createdAt: repository.createdAt.toISOString(),
            updatedAt: repository.updatedAt.toISOString(),
        };
    }

    async update(
        id: string,
        input: UpdateMarketplaceRepositoryRequest,
    ): Promise<MarketplaceRepository> {
        if (id === OFFICIAL_REPOSITORY_ID) {
            throw new BadRequestException(
                'The official Tyravex repository cannot be modified.',
            );
        }

        const existing = await this.prisma.pluginRepository.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new NotFoundException('Repository not found.');
        }

        if (existing.isOfficial) {
            throw new BadRequestException(
                'The official Tyravex repository cannot be modified.',
            );
        }

        if (input.name === undefined && input.status === undefined) {
            throw new BadRequestException(
                'At least one field must be provided.',
            );
        }

        const name = input.name?.trim();

        if (name !== undefined && name.length < 2) {
            throw new BadRequestException(
                'Repository name must contain at least 2 characters.',
            );
        }

        const result = await this.prisma.pluginRepository.updateMany({
            where: {
                id,
                isOfficial: false,
            },
            data: {
                ...(name !== undefined ? { name } : {}),
                ...(input.status !== undefined
                    ? { status: input.status }
                    : {}),
            },
        });

        if (result.count !== 1) {
            throw new ConflictException(
                'Repository was modified or is no longer editable.',
            );
        }

        const repository = await this.prisma.pluginRepository.findUnique({
            where: { id },
        });

        if (!repository) {
            throw new NotFoundException('Repository not found.');
        }

        return {
            id: repository.id,
            name: repository.name,
            url: repository.url,
            isOfficial: repository.isOfficial,
            status: repository.status,
            createdAt: repository.createdAt.toISOString(),
            updatedAt: repository.updatedAt.toISOString(),
        };
    }

    async remove(id: string): Promise<void> {
        if (id === OFFICIAL_REPOSITORY_ID) {
            throw new BadRequestException(
                'The official Tyravex repository cannot be deleted.',
            );
        }

        const existing = await this.prisma.pluginRepository.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new NotFoundException('Repository not found.');
        }

        if (existing.isOfficial) {
            throw new BadRequestException(
                'The official Tyravex repository cannot be deleted.',
            );
        }

        const result = await this.prisma.pluginRepository.deleteMany({
            where: {
                id,
                isOfficial: false,
            },
        });

        if (result.count !== 1) {
            throw new ConflictException(
                'Repository was modified or is no longer deletable.',
            );
        }
    }
}
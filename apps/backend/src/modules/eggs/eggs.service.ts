import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';

import { CreateEggRepositoryDto } from './dto/create-egg-repository.dto';
import { validateEggManifest } from './egg-manifest.validator';

type RepositoryStatus = 'ENABLED' | 'DISABLED';

@Injectable()
export class EggsService {
    constructor(private readonly prisma: PrismaService) { }

    async listRepositories() {
        return this.prisma.eggRepository.findMany({
            select: {
                id: true,
                name: true,
                url: true,
                isOfficial: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        eggs: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async listEggs(repositoryId: string) {
        const repository = await this.prisma.eggRepository.findUnique({
            where: {
                id: repositoryId,
            },
            select: {
                id: true,
            },
        });

        if (!repository) {
            throw new NotFoundException('Egg repository not found');
        }

        return this.prisma.egg.findMany({
            where: {
                repositoryId,
            },
            select: {
                id: true,
                key: true,
                name: true,
                description: true,
                version: true,
                isEnabled: true,
                repositoryId: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: [
                {
                    key: 'asc',
                },
                {
                    createdAt: 'desc',
                },
            ],
        });
    }

    async createRepository(
        actorId: number,
        dto: CreateEggRepositoryDto,
    ) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const repository = await tx.eggRepository.create({
                    data: {
                        name: dto.name,
                        url: dto.url,
                        isOfficial: false,
                        status: 'DISABLED',
                    },
                });

                await tx.adminAuditLog.create({
                    data: {
                        actorId,
                        action: 'EGG_REPOSITORY_CREATED',
                        targetType: 'EGG_REPOSITORY',
                        targetId: repository.id,
                        metadata: {
                            name: repository.name,
                        },
                    },
                });

                return repository;
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new ConflictException(
                    'Egg repository already exists',
                );
            }

            throw error;
        }
    }

    async importEgg(
        actorId: number,
        repositoryId: string,
        rawManifest: unknown,
    ) {
        const parsed = validateEggManifest(rawManifest);

        try {
            return await this.prisma.$transaction(async (tx) => {
                const repository = await tx.eggRepository.findUnique({
                    where: {
                        id: repositoryId,
                    },
                    select: {
                        id: true,
                    },
                });

                if (!repository) {
                    throw new NotFoundException(
                        'Egg repository not found',
                    );
                }

                const egg = await tx.egg.create({
                    data: {
                        repositoryId,
                        key: parsed.key,
                        name: parsed.name,
                        description: parsed.description,
                        version: parsed.version,
                        manifest: parsed.manifest,
                        isEnabled: false,
                    },
                    select: {
                        id: true,
                        key: true,
                        name: true,
                        version: true,
                        repositoryId: true,
                        isEnabled: true,
                        createdAt: true,
                    },
                });

                await tx.adminAuditLog.create({
                    data: {
                        actorId,
                        action: 'EGG_IMPORTED',
                        targetType: 'EGG',
                        targetId: egg.id,
                        metadata: {
                            repositoryId,
                            key: egg.key,
                            version: egg.version,
                        },
                    },
                });

                return egg;
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new ConflictException(
                    'This egg version already exists in the repository',
                );
            }

            throw error;
        }
    }

    async setRepositoryStatus(
        actorId: number,
        repositoryId: string,
        status: RepositoryStatus,
    ) {
        return this.prisma.$transaction(async (tx) => {
            // Serialize repository and egg status changes.
            const locked = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id"
                FROM "EggRepository"
                WHERE "id" = ${repositoryId}
                FOR UPDATE
            `;

            if (locked.length === 0) {
                throw new NotFoundException(
                    'Egg repository not found',
                );
            }

            const repository = await tx.eggRepository.findUnique({
                where: {
                    id: repositoryId,
                },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    updatedAt: true,
                },
            });

            if (!repository) {
                throw new NotFoundException(
                    'Egg repository not found',
                );
            }

            // Avoid unnecessary updates and audit entries.
            if (repository.status === status) {
                return repository;
            }

            const updated = await tx.eggRepository.update({
                where: {
                    id: repositoryId,
                },
                data: {
                    status,
                },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    updatedAt: true,
                },
            });

            await tx.adminAuditLog.create({
                data: {
                    actorId,
                    action: 'EGG_REPOSITORY_STATUS_CHANGED',
                    targetType: 'EGG_REPOSITORY',
                    targetId: repositoryId,
                    metadata: {
                        previousStatus: repository.status,
                        status,
                    },
                },
            });

            return updated;
        });
    }

    async setEggStatus(
        actorId: number,
        eggId: string,
        isEnabled: boolean,
    ) {
        return this.prisma.$transaction(async (tx) => {
            // Find the repository before acquiring its lock.
            const eggReference = await tx.egg.findUnique({
                where: {
                    id: eggId,
                },
                select: {
                    repositoryId: true,
                },
            });

            if (!eggReference) {
                throw new NotFoundException('Egg not found');
            }

            // Serialize changes with repository status updates.
            const locked = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id"
                FROM "EggRepository"
                WHERE "id" = ${eggReference.repositoryId}
                FOR UPDATE
            `;

            if (locked.length === 0) {
                throw new NotFoundException(
                    'Egg repository not found',
                );
            }

            const egg = await tx.egg.findUnique({
                where: {
                    id: eggId,
                },
                select: {
                    id: true,
                    key: true,
                    version: true,
                    isEnabled: true,
                    updatedAt: true,
                    repository: {
                        select: {
                            status: true,
                        },
                    },
                },
            });

            if (!egg) {
                throw new NotFoundException('Egg not found');
            }

            // An egg cannot be enabled in a disabled repository.
            if (
                isEnabled &&
                egg.repository.status !== 'ENABLED'
            ) {
                throw new ConflictException(
                    'Enable the egg repository first',
                );
            }

            // Return the same response shape without modifying the database.
            if (egg.isEnabled === isEnabled) {
                return {
                    id: egg.id,
                    key: egg.key,
                    version: egg.version,
                    isEnabled: egg.isEnabled,
                    updatedAt: egg.updatedAt,
                };
            }

            const updated = await tx.egg.update({
                where: {
                    id: eggId,
                },
                data: {
                    isEnabled,
                },
                select: {
                    id: true,
                    key: true,
                    version: true,
                    isEnabled: true,
                    updatedAt: true,
                },
            });

            await tx.adminAuditLog.create({
                data: {
                    actorId,
                    action: 'EGG_STATUS_CHANGED',
                    targetType: 'EGG',
                    targetId: eggId,
                    metadata: {
                        previousIsEnabled: egg.isEnabled,
                        isEnabled,
                    },
                },
            });

            return updated;
        });
    }
}

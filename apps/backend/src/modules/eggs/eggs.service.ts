import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateEggRepositoryDto } from './dto/create-egg-repository.dto';
import { assertEggApproved } from './egg-approval.policy';
import { validateEggManifest } from './egg-manifest.validator';

type RepositoryStatus = 'ENABLED' | 'DISABLED';
type EggApprovalDecision = 'APPROVED' | 'REJECTED';

@Injectable()
export class EggsService {
    constructor(private readonly prisma: PrismaService) { }

    async listRepositories() {
        return this.prisma.eggRepository.findMany({
            select: {
                id: true, name: true, url: true, isOfficial: true, status: true,
                createdAt: true, updatedAt: true,
                _count: { select: { eggs: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async listEggs(repositoryId: string) {
        const repository = await this.prisma.eggRepository.findUnique({
            where: { id: repositoryId }, select: { id: true },
        });
        if (!repository) throw new NotFoundException('Egg repository not found');
        return this.prisma.egg.findMany({
            where: { repositoryId },
            select: {
                id: true, key: true, name: true, description: true, version: true,
                isEnabled: true, repositoryId: true, sourceType: true,
                approvalStatus: true, ownerId: true, createdAt: true, updatedAt: true,
            },
            orderBy: [{ key: 'asc' }, { createdAt: 'desc' }],
        });
    }

    async createRepository(actorId: number, dto: CreateEggRepositoryDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const repository = await tx.eggRepository.create({
                    data: { name: dto.name, url: dto.url, isOfficial: false, status: 'DISABLED' },
                });
                await tx.adminAuditLog.create({
                    data: {
                        actorId, action: 'EGG_REPOSITORY_CREATED',
                        targetType: 'EGG_REPOSITORY', targetId: repository.id,
                        metadata: { name: repository.name },
                    },
                });
                return repository;
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException('Egg repository already exists');
            }
            throw error;
        }
    }

    async importEgg(actorId: number, repositoryId: string, rawManifest: unknown) {
        const parsed = validateEggManifest(rawManifest);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const repository = await tx.eggRepository.findUnique({
                    where: { id: repositoryId }, select: { id: true },
                });
                if (!repository) throw new NotFoundException('Egg repository not found');

                // Administrative imports are community definitions until reviewed.
                // Repository metadata cannot independently grant official provenance.
                const egg = await tx.egg.create({
                    data: {
                        repositoryId, key: parsed.key, name: parsed.name,
                        description: parsed.description, version: parsed.version,
                        manifest: parsed.manifest, sourceType: 'COMMUNITY',
                        approvalStatus: 'PENDING', approvedAt: null,
                        ownerId: null, isEnabled: false,
                    },
                    select: {
                        id: true, key: true, name: true, version: true,
                        repositoryId: true, sourceType: true, approvalStatus: true,
                        isEnabled: true, createdAt: true,
                    },
                });
                await tx.adminAuditLog.create({
                    data: {
                        actorId, action: 'EGG_IMPORTED', targetType: 'EGG', targetId: egg.id,
                        metadata: {
                            repositoryId, key: egg.key, version: egg.version,
                            sourceType: egg.sourceType,
                        },
                    },
                });
                return egg;
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException('This egg version already exists in the repository');
            }
            throw error;
        }
    }

    async createCustomEgg(ownerId: number, rawManifest: unknown) {
        // Only the authenticated user ID is accepted; never trust owner metadata
        // from a submitted manifest or request body.
        if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
            throw new BadRequestException('Invalid authenticated user');
        }

        const parsed = validateEggManifest(rawManifest);
        const repositoryUrl = `tyravex-custom://user/${ownerId}`;

        try {
            return await this.prisma.$transaction(async (tx) => {
                // Serialize creation of the per-user virtual repository. This also
                // ensures that the existing (repositoryId, key, version) uniqueness
                // constraint prevents duplicate uploads by the same owner.
                await tx.$queryRaw`
                    SELECT 1 AS acquired
                    FROM pg_advisory_xact_lock(67421, ${ownerId})
                `;

                let repository = await tx.eggRepository.findFirst({
                    where: { url: repositoryUrl, isOfficial: false },
                    select: { id: true },
                });

                if (!repository) {
                    repository = await tx.eggRepository.create({
                        data: {
                            name: `Custom Eggs - user ${ownerId}`,
                            // Internal scheme: this is NOT a remote repository URL.
                            url: repositoryUrl,
                            isOfficial: false,
                            // Approval and Egg enablement remain separate gates.
                            status: 'ENABLED',
                        },
                        select: { id: true },
                    });
                }

                const egg = await tx.egg.create({
                    data: {
                        repositoryId: repository.id,
                        key: parsed.key,
                        name: parsed.name,
                        description: parsed.description,
                        version: parsed.version,
                        manifest: parsed.manifest,
                        sourceType: 'CUSTOM',
                        ownerId,
                        approvalStatus: 'PENDING',
                        approvedAt: null,
                        isEnabled: false,
                    },
                    select: {
                        id: true, key: true, name: true, description: true,
                        version: true, repositoryId: true, sourceType: true,
                        approvalStatus: true, ownerId: true, isEnabled: true,
                        createdAt: true, updatedAt: true,
                    },
                });

                await tx.adminAuditLog.create({
                    data: {
                        actorId: ownerId,
                        action: 'EGG_CUSTOM_SUBMITTED',
                        targetType: 'EGG',
                        targetId: egg.id,
                        metadata: {
                            repositoryId: repository.id,
                            key: egg.key,
                            version: egg.version,
                            sourceType: 'CUSTOM',
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
                    'This custom Egg version has already been submitted',
                );
            }
            throw error;
        }
    }

    async listMyEggs(ownerId: number) {
        if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
            throw new BadRequestException('Invalid authenticated user');
        }

        return this.prisma.egg.findMany({
            where: { ownerId, sourceType: 'CUSTOM' },
            select: {
                id: true, key: true, name: true, description: true,
                version: true, repositoryId: true, sourceType: true,
                approvalStatus: true, ownerId: true, isEnabled: true,
                createdAt: true, updatedAt: true,
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
    }

    async setRepositoryStatus(actorId: number, repositoryId: string, status: RepositoryStatus) {
        return this.prisma.$transaction(async (tx) => {
            // Serialize repository and Egg status changes.
            const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "EggRepository" WHERE "id" = ${repositoryId} FOR UPDATE
      `;
            if (locked.length === 0) throw new NotFoundException('Egg repository not found');
            const repository = await tx.eggRepository.findUnique({
                where: { id: repositoryId },
                select: { id: true, name: true, status: true, updatedAt: true },
            });
            if (!repository) throw new NotFoundException('Egg repository not found');
            if (repository.status === status) return repository;
            const updated = await tx.eggRepository.update({
                where: { id: repositoryId }, data: { status },
                select: { id: true, name: true, status: true, updatedAt: true },
            });
            await tx.adminAuditLog.create({
                data: {
                    actorId, action: 'EGG_REPOSITORY_STATUS_CHANGED',
                    targetType: 'EGG_REPOSITORY', targetId: repositoryId,
                    metadata: { previousStatus: repository.status, status },
                },
            });
            return updated;
        });
    }

    async setEggStatus(actorId: number, eggId: string, isEnabled: boolean) {
        return this.prisma.$transaction(async (tx) => {
            const eggReference = await tx.egg.findUnique({
                where: { id: eggId }, select: { repositoryId: true },
            });
            if (!eggReference) throw new NotFoundException('Egg not found');
            // Use the same repository lock as approval and repository status changes.
            const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "EggRepository"
        WHERE "id" = ${eggReference.repositoryId} FOR UPDATE
      `;
            if (locked.length === 0) throw new NotFoundException('Egg repository not found');
            const egg = await tx.egg.findUnique({
                where: { id: eggId },
                select: {
                    id: true, key: true, version: true, isEnabled: true,
                    approvalStatus: true, updatedAt: true,
                    repository: { select: { status: true } },
                },
            });
            if (!egg) throw new NotFoundException('Egg not found');
            if (isEnabled) {
                assertEggApproved(egg.approvalStatus);
                if (egg.repository.status !== 'ENABLED') {
                    throw new ConflictException('Enable the egg repository first');
                }
            }
            if (egg.isEnabled === isEnabled) {
                return {
                    id: egg.id, key: egg.key, version: egg.version,
                    isEnabled: egg.isEnabled, updatedAt: egg.updatedAt,
                };
            }
            const updated = await tx.egg.update({
                where: { id: eggId }, data: { isEnabled },
                select: { id: true, key: true, version: true, isEnabled: true, updatedAt: true },
            });
            await tx.adminAuditLog.create({
                data: {
                    actorId, action: 'EGG_STATUS_CHANGED', targetType: 'EGG', targetId: eggId,
                    metadata: { previousIsEnabled: egg.isEnabled, isEnabled },
                },
            });
            return updated;
        });
    }

    async setEggApproval(actorId: number, eggId: string, status: EggApprovalDecision) {
        // Do not rely on TypeScript types for runtime validation.
        if (status !== 'APPROVED' && status !== 'REJECTED') {
            throw new BadRequestException('Invalid Egg approval status');
        }

        return this.prisma.$transaction(async (tx) => {
            const eggReference = await tx.egg.findUnique({
                where: { id: eggId }, select: { repositoryId: true },
            });
            if (!eggReference) throw new NotFoundException('Egg not found');

            // Lock the repository in the same order as activation, assignment,
            // and installation preparation. This prevents concurrent enable/reject races.
            const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "EggRepository"
        WHERE "id" = ${eggReference.repositoryId} FOR UPDATE
      `;
            if (locked.length === 0) throw new NotFoundException('Egg repository not found');

            const egg = await tx.egg.findUnique({
                where: { id: eggId },
                select: {
                    id: true, key: true, version: true, approvalStatus: true,
                    approvedAt: true, isEnabled: true, updatedAt: true,
                },
            });
            if (!egg) throw new NotFoundException('Egg not found');

            // Repeated decisions are idempotent, except a rejected Egg must be disabled.
            if (egg.approvalStatus === status && (status !== 'REJECTED' || !egg.isEnabled)) {
                return egg;
            }

            const updated = await tx.egg.update({
                where: { id: eggId },
                data: {
                    approvalStatus: status,
                    approvedAt: status === 'APPROVED' ? new Date() : null,
                    ...(status === 'REJECTED' ? { isEnabled: false } : {}),
                },
                select: {
                    id: true, key: true, version: true, approvalStatus: true,
                    approvedAt: true, isEnabled: true, updatedAt: true,
                },
            });
            await tx.adminAuditLog.create({
                data: {
                    actorId, action: 'EGG_APPROVAL_CHANGED',
                    targetType: 'EGG', targetId: eggId,
                    metadata: {
                        previousApprovalStatus: egg.approvalStatus,
                        approvalStatus: status,
                        previousIsEnabled: egg.isEnabled,
                        isEnabled: updated.isEnabled,
                    },
                },
            });
            return updated;
        });
    }

    async listLibraryEggs(options: { query?: string; page?: string; pageSize?: string }) {
        const parsePositiveInteger = (
            value: string | undefined, fallback: number, max: number,
        ): number => {
            if (value === undefined) return fallback;
            if (!/^[1-9]\d*$/.test(value)) {
                throw new BadRequestException('Invalid pagination parameter');
            }
            const parsed = Number(value);
            if (!Number.isSafeInteger(parsed) || parsed > max) {
                throw new BadRequestException('Pagination parameter out of range');
            }
            return parsed;
        };
        const page = parsePositiveInteger(options.page, 1, 1_000_000);
        const pageSize = parsePositiveInteger(options.pageSize, 20, 100);
        if (
            options.query !== undefined &&
            (typeof options.query !== 'string' || options.query.length > 100)
        ) {
            throw new BadRequestException('Invalid search query');
        }
        const query = options.query?.trim();
        const where: Prisma.EggWhereInput = query ? {
            OR: [
                { key: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
            ],
        } : {};
        const [total, items] = await this.prisma.$transaction([
            this.prisma.egg.count({ where }),
            this.prisma.egg.findMany({
                where,
                select: {
                    id: true, key: true, name: true, description: true, version: true,
                    isEnabled: true, repositoryId: true, sourceType: true,
                    approvalStatus: true, ownerId: true, createdAt: true, updatedAt: true,
                },
                orderBy: [{ name: 'asc' }, { id: 'asc' }],
                skip: (page - 1) * pageSize, take: pageSize,
            }),
        ]);
        const totalPages = Math.ceil(total / pageSize);
        return {
            items,
            pagination: {
                page, pageSize, total, totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1 && totalPages > 0,
            },
        };
    }

    async getLibraryEgg(id: string) {
        const egg = await this.prisma.egg.findUnique({
            where: { id },
            select: {
                id: true, key: true, name: true, description: true, version: true,
                isEnabled: true, repositoryId: true, sourceType: true,
                approvalStatus: true, ownerId: true, createdAt: true, updatedAt: true,
            },
        });
        if (!egg) throw new NotFoundException('Egg not found');
        return egg;
    }

    async getLibraryStats() {
        const [total, enabled] = await Promise.all([
            this.prisma.egg.count(),
            this.prisma.egg.count({ where: { isEnabled: true } }),
        ]);
        return { total, enabled, disabled: total - enabled };
    }
}

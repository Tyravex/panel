import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';

type StablePluginStatus = 'INSTALLED' | 'DISABLED';

@Injectable()
export class PluginLifecycleService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    enable(id: string, actorId: number) {
        return this.changeStatus(id, 'INSTALLED', actorId);
    }

    disable(id: string, actorId: number) {
        return this.changeStatus(id, 'DISABLED', actorId);
    }

    private async changeStatus(
        id: string,
        targetStatus: StablePluginStatus,
        actorId: number,
    ) {
        if (!Number.isSafeInteger(actorId) || actorId <= 0) {
            throw new ConflictException(
                'A valid administrator identity is required.',
            );
        }

        return this.prisma.$transaction(async (tx) => {
            const plugin = await tx.plugin.findUnique({
                where: { id },
                select: {
                    id: true,
                    type: true,
                    version: true,
                    status: true,
                },
            });

            if (!plugin) {
                throw new NotFoundException(
                    'Plugin not found.',
                );
            }

            if (
                plugin.status !== 'INSTALLED' &&
                plugin.status !== 'DISABLED'
            ) {
                throw new ConflictException(
                    'Plugin cannot be changed in its current state.',
                );
            }

            if (plugin.status === targetStatus) {
                throw new ConflictException(
                    targetStatus === 'INSTALLED'
                        ? 'Plugin is already enabled.'
                        : 'Plugin is already disabled.',
                );
            }

            const updated = await tx.plugin.updateMany({
                where: {
                    id,
                    status: plugin.status,
                },
                data: {
                    status: targetStatus,
                },
            });

            if (updated.count !== 1) {
                throw new ConflictException(
                    'Plugin was modified concurrently.',
                );
            }

            if (plugin.type === 'LANGUAGE') {
                await tx.language.updateMany({
                    where: {
                        pluginId: id,
                        isBuiltIn: false,
                    },
                    data: {
                        isEnabled: targetStatus === 'INSTALLED',
                    },
                });
            }

            await tx.adminAuditLog.create({
                data: {
                    actorId,
                    action:
                        targetStatus === 'INSTALLED'
                            ? 'plugin.enabled'
                            : 'plugin.disabled',
                    targetType: 'Plugin',
                    targetId: id,
                    metadata: {
                        version: plugin.version,
                        previousStatus: plugin.status,
                        newStatus: targetStatus,
                    },
                },
            });

            return tx.plugin.findUniqueOrThrow({
                where: { id },
                select: {
                    id: true,
                    type: true,
                    version: true,
                    status: true,
                    sourceRepository: true,
                    installedAt: true,
                    updatedAt: true,
                },
            });
        });
    }
}
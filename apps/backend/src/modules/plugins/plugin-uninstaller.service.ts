import {
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
    lstat,
    mkdir,
    rename,
    rm,
} from 'node:fs/promises';
import {
    dirname,
    isAbsolute,
    join,
    relative,
    resolve,
    sep,
} from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';

import { getPluginStorageRoot } from './plugin-storage.config';

export interface UninstalledPluginResult {
    id: string;
    removed: true;
    cleanupPending: boolean;
}

@Injectable()
export class PluginUninstallerService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async uninstall(
        id: string,
        actorId: number,
    ): Promise<UninstalledPluginResult> {
        if (!Number.isSafeInteger(actorId) || actorId <= 0) {
            throw new ConflictException(
                'A valid administrator identity is required.',
            );
        }

        const plugin = await this.prisma.plugin.findUnique({
            where: { id },
            select: {
                id: true,
                type: true,
                version: true,
                status: true,
                storagePath: true,
                uninstallOperationId: true,
            },
        });

        if (!plugin) {
            throw new NotFoundException('Plugin not found.');
        }

        if (
            plugin.status !== 'INSTALLED' &&
            plugin.status !== 'DISABLED'
        ) {
            throw new ConflictException(
                'Plugin cannot be uninstalled in its current state.',
            );
        }

        if (plugin.uninstallOperationId !== null) {
            throw new ConflictException(
                'Plugin already has an uninstall operation.',
            );
        }

        const root = getPluginStorageRoot();

        const source = this.resolveOwnedDirectory(
            root,
            plugin.id,
            plugin.storagePath,
        );

        const operationId = randomUUID();

        const quarantineRoot = join(
            root,
            '.uninstalling',
        );

        const quarantine = join(
            quarantineRoot,
            operationId,
        );

        const reserved = await this.prisma.plugin.updateMany({
            where: {
                id,
                version: plugin.version,
                status: plugin.status,
                storagePath: plugin.storagePath,
                uninstallOperationId: null,
            },
            data: {
                status: 'UNINSTALLING',
                uninstallOperationId: operationId,
            },
        });

        if (reserved.count !== 1) {
            throw new ConflictException(
                'Plugin was modified concurrently.',
            );
        }

        let moved = false;
        let committed = false;

        try {
            await this.assertOwnedDirectory(
                root,
                source,
            );

            await mkdir(quarantineRoot, {
                recursive: true,
                mode: 0o700,
            });

            await this.assertRegularDirectory(
                quarantineRoot,
            );

            await rename(source, quarantine);
            moved = true;

            await this.prisma.$transaction(async (tx) => {
                const current = await tx.plugin.findUnique({
                    where: { id },
                    select: {
                        status: true,
                        version: true,
                        storagePath: true,
                        uninstallOperationId: true,
                    },
                });

                if (
                    current?.status !== 'UNINSTALLING' ||
                    current.version !== plugin.version ||
                    current.storagePath !== plugin.storagePath ||
                    current.uninstallOperationId !== operationId
                ) {
                    throw new ConflictException(
                        'Plugin reservation changed during uninstall.',
                    );
                }

                const linkedLanguages =
                    await tx.language.findMany({
                        where: {
                            pluginId: id,
                        },
                        select: {
                            code: true,
                            isBuiltIn: true,
                            isFallback: true,
                        },
                    });

                if (
                    linkedLanguages.some(
                        (language) =>
                            language.isBuiltIn ||
                            language.isFallback,
                    )
                ) {
                    throw new ConflictException(
                        'A built-in or fallback language cannot be uninstalled.',
                    );
                }

                await tx.language.deleteMany({
                    where: {
                        pluginId: id,
                        isBuiltIn: false,
                        isFallback: false,
                    },
                });

                const deleted = await tx.plugin.deleteMany({
                    where: {
                        id,
                        status: 'UNINSTALLING',
                        version: plugin.version,
                        storagePath: plugin.storagePath,
                        uninstallOperationId: operationId,
                    },
                });

                if (deleted.count !== 1) {
                    throw new ConflictException(
                        'Plugin changed during uninstall.',
                    );
                }

                await tx.adminAuditLog.create({
                    data: {
                        actorId,
                        action: 'plugin.uninstalled',
                        targetType: 'Plugin',
                        targetId: id,
                        metadata: {
                            operationId,
                            type: plugin.type,
                            version: plugin.version,
                            previousStatus: plugin.status,
                            languageCodes: linkedLanguages.map(
                                (language) => language.code,
                            ),
                        },
                    },
                });
            });

            committed = true;
        } catch (error) {
            if (committed) {
                throw error;
            }

            let rollbackFailed = false;

            if (moved) {
                try {
                    await rename(quarantine, source);
                } catch {
                    rollbackFailed = true;
                }
            }

            if (!rollbackFailed) {
                try {
                    const restored =
                        await this.prisma.plugin.updateMany({
                            where: {
                                id,
                                status: 'UNINSTALLING',
                                version: plugin.version,
                                storagePath: plugin.storagePath,
                                uninstallOperationId: operationId,
                            },
                            data: {
                                status: plugin.status,
                                uninstallOperationId: null,
                            },
                        });

                    if (restored.count !== 1) {
                        rollbackFailed = true;
                    }
                } catch {
                    rollbackFailed = true;
                }
            }

            if (rollbackFailed) {
                throw new InternalServerErrorException(
                    'Plugin uninstall failed and rollback was incomplete.',
                );
            }

            throw error;
        }

        try {
            await this.assertRegularDirectory(quarantine);

            await rm(quarantine, {
                recursive: true,
                force: false,
            });

            return {
                id,
                removed: true,
                cleanupPending: false,
            };
        } catch {
            return {
                id,
                removed: true,
                cleanupPending: true,
            };
        }
    }

    private resolveOwnedDirectory(
        root: string,
        pluginId: string,
        storagePath: string,
    ): string {
        if (
            !storagePath ||
            isAbsolute(storagePath) ||
            storagePath.includes('\\')
        ) {
            throw new ConflictException(
                'Plugin storage path is invalid.',
            );
        }

        const segments = storagePath.split('/');

        if (
            segments.length !== 2 ||
            segments[1] !== 'package' ||
            segments.some(
                (segment) =>
                    !segment ||
                    segment === '.' ||
                    segment === '..',
            )
        ) {
            throw new ConflictException(
                'Plugin storage layout is invalid.',
            );
        }

        const prefix = `${pluginId}-`;

        if (
            !segments[0].startsWith(prefix) ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                segments[0].slice(prefix.length),
            )
        ) {
            throw new ConflictException(
                'Plugin directory does not match its registry entry.',
            );
        }

        const directory = resolve(
            root,
            segments[0],
        );

        const relativePath = relative(
            resolve(root),
            directory,
        );

        if (
            !relativePath ||
            relativePath === '..' ||
            relativePath.startsWith(`..${sep}`) ||
            isAbsolute(relativePath)
        ) {
            throw new ConflictException(
                'Plugin directory is outside storage.',
            );
        }

        return directory;
    }

    private async assertOwnedDirectory(
        root: string,
        directory: string,
    ): Promise<void> {
        await this.assertRegularDirectory(root);
        await this.assertRegularDirectory(directory);

        if (dirname(directory) !== resolve(root)) {
            throw new ConflictException(
                'Plugin directory ownership check failed.',
            );
        }

        await this.assertRegularDirectory(
            join(directory, 'package'),
        );
    }

    private async assertRegularDirectory(
        path: string,
    ): Promise<void> {
        const stats = await lstat(path);

        if (
            !stats.isDirectory() ||
            stats.isSymbolicLink()
        ) {
            throw new ConflictException(
                'Plugin storage contains an unsafe directory.',
            );
        }
    }
}
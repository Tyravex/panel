import {
    ConflictException,
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
    lstat,
    mkdir,
    rename,
    rm,
} from 'node:fs/promises';
import { join } from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';

import {
    discardStagedPluginPackage,
    stagePluginPackage,
    type StagedPluginPackage,
} from './plugin-package-staging';
import { getPluginStorageRoot } from './plugin-storage.config';

export interface InstalledPluginResult {
    id: string;
    type: 'LANGUAGE';
    version: string;
    status: 'INSTALLED';
}

@Injectable()
export class PluginInstallerService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async installLanguagePackage(
        archive: Buffer,
    ): Promise<InstalledPluginResult> {
        const staged = await stagePluginPackage(archive);
        const manifest = staged.inspection.manifest;

        const root = getPluginStorageRoot();
        const directoryName = `${manifest.id}-${randomUUID()}`;
        const reservationDirectory = join(root, directoryName);
        const storagePath = `${directoryName}/package`;
        const destination = join(reservationDirectory, 'package');

        let databaseReserved = false;
        let directoryReserved = false;

        try {
            try {
                await this.prisma.plugin.create({
                    data: {
                        id: manifest.id,
                        type: 'LANGUAGE',
                        version: manifest.version,
                        status: 'INSTALLING',
                        storagePath,
                        sourceRepository: null,
                    },
                });

                databaseReserved = true;
            } catch (error) {
                if (this.isUniqueConflict(error)) {
                    throw new ConflictException(
                        'Plugin is already registered.',
                    );
                }

                throw error;
            }

            // Exclusive directory creation prevents adopting
            // a directory belonging to another installation.
            await mkdir(reservationDirectory, {
                mode: 0o700,
            });

            directoryReserved = true;

            // Publish inside the directory owned by this attempt.
            await rename(staged.stagingPath, destination);

            const updated = await this.prisma.plugin.updateMany({
                where: {
                    id: manifest.id,
                    type: 'LANGUAGE',
                    version: manifest.version,
                    status: 'INSTALLING',
                    storagePath,
                },
                data: {
                    status: 'INSTALLED',
                },
            });

            if (updated.count !== 1) {
                throw new Error(
                    'Plugin reservation was modified during installation.',
                );
            }

            return {
                id: manifest.id,
                type: 'LANGUAGE',
                version: manifest.version,
                status: 'INSTALLED',
            };
        } catch (error) {
            let filesystemClean = !directoryReserved;
            const cleanupErrors: unknown[] = [];

            if (directoryReserved) {
                try {
                    await this.removeOwnedDirectory(
                        reservationDirectory,
                    );

                    filesystemClean = true;
                } catch (cleanupError) {
                    cleanupErrors.push(cleanupError);
                }
            }

            if (databaseReserved) {
                if (filesystemClean) {
                    try {
                        const deleted = await this.prisma.plugin.deleteMany({
                            where: {
                                id: manifest.id,
                                type: 'LANGUAGE',
                                version: manifest.version,
                                status: 'INSTALLING',
                                storagePath,
                            },
                        });

                        if (deleted.count !== 1) {
                            cleanupErrors.push(
                                new Error(
                                    'Plugin reservation could not be removed.',
                                ),
                            );
                        }
                    } catch (cleanupError) {
                        cleanupErrors.push(cleanupError);
                    }
                }

                // Keep incomplete installations visible in the
                // registry when cleanup cannot be completed.
                if (cleanupErrors.length > 0) {
                    try {
                        const failed = await this.prisma.plugin.updateMany({
                            where: {
                                id: manifest.id,
                                type: 'LANGUAGE',
                                version: manifest.version,
                                status: 'INSTALLING',
                                storagePath,
                            },
                            data: {
                                status: 'FAILED',
                            },
                        });

                        // A zero count can mean that the reservation
                        // changed or was already removed. Do not
                        // overwrite a different installation.
                        if (failed.count !== 1) {
                            cleanupErrors.push(
                                new Error(
                                    'Plugin failure status could not be recorded.',
                                ),
                            );
                        }
                    } catch (statusError) {
                        cleanupErrors.push(statusError);
                    }
                }
            }

            if (cleanupErrors.length > 0) {
                throw new InternalServerErrorException(
                    'Plugin installation failed and rollback was incomplete.',
                );
            }

            throw error;
        } finally {
            await this.discardIfPresent(staged);
        }
    }

    private async removeOwnedDirectory(
        directory: string,
    ): Promise<void> {
        const stats = await lstat(directory);

        if (
            !stats.isDirectory() ||
            stats.isSymbolicLink()
        ) {
            throw new Error(
                'Installation directory is not a regular directory.',
            );
        }

        await rm(directory, {
            recursive: true,
            force: false,
        });
    }

    private isUniqueConflict(
        error: unknown,
    ): boolean {
        return (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'P2002'
        );
    }

    private async discardIfPresent(
        staged: StagedPluginPackage,
    ): Promise<void> {
        try {
            await lstat(staged.stagingPath);
        } catch (error) {
            if (
                (error as NodeJS.ErrnoException).code === 'ENOENT'
            ) {
                return;
            }

            throw error;
        }

        await discardStagedPluginPackage(staged);
    }
}

import {
    lstat,
    readdir,
} from 'node:fs/promises';
import { basename, join } from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';

import {
    getPluginStorageRoot,
} from './plugin-storage.config';

export const INSTALLATION_RECOVERY_MIN_AGE_MS =
    30 * 60 * 1000;

const INSTALLATION_DIRECTORY_PATTERN =
    /^[a-z0-9]+(?:[.-][a-z0-9]+)*-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}(?:\/package)?$/i;

const STAGING_DIRECTORY_PATTERN =
    /^\.staging-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}-[a-zA-Z0-9]+$/;

export interface IncompletePluginInstallation {
    id: string;
    storagePath: string;
    installedAt: Date;
    directoryState:
    | 'present'
    | 'missing'
    | 'unexpected';
}

export interface OrphanedPluginStagingDirectory {
    name: string;
    directoryState:
    | 'directory'
    | 'unexpected';
}

export interface PluginInstallationRecoveryReport {
    incompleteInstallations:
    IncompletePluginInstallation[];
    orphanedStagingDirectories:
    OrphanedPluginStagingDirectory[];
}

const inspectDirectory = async (
    path: string,
): Promise<'present' | 'missing' | 'unexpected'> => {
    try {
        const stats = await lstat(path);

        return stats.isDirectory() &&
            !stats.isSymbolicLink()
            ? 'present'
            : 'unexpected';
    } catch (error) {
        if (
            (error as NodeJS.ErrnoException).code ===
            'ENOENT'
        ) {
            return 'missing';
        }

        throw error;
    }
};

/**
 * Reports stale installation artifacts.
 *
 * This function deliberately does not mutate the
 * database or filesystem. It must not be used as
 * an automatic destructive cleanup routine.
 */
export const inspectIncompletePluginInstallations =
    async (
        prisma: PrismaService,
        now: Date = new Date(),
    ): Promise<PluginInstallationRecoveryReport> => {
        const storageRoot = getPluginStorageRoot();

        const cutoff = new Date(
            now.getTime() -
            INSTALLATION_RECOVERY_MIN_AGE_MS,
        );

        const reservations =
            await prisma.plugin.findMany({
                where: {
                    type: 'LANGUAGE',
                    status: {
                        in: ['INSTALLING', 'FAILED'],
                    },
                    installedAt: {
                        lt: cutoff,
                    },
                },
                select: {
                    id: true,
                    storagePath: true,
                    installedAt: true,
                },
            });

        const incompleteInstallations:
            IncompletePluginInstallation[] = [];

        for (const reservation of reservations) {
            // Ordinary disabled plugins must not be
            // mistaken for unfinished installations.
            if (
                !INSTALLATION_DIRECTORY_PATTERN.test(
                    reservation.storagePath,
                ) ||
                !reservation.storagePath.startsWith(
                    `${reservation.id}-`,
                )
            ) {
                continue;
            }

            const directoryState =
                await inspectDirectory(
                    join(
                        storageRoot,
                        reservation.storagePath,
                    ),
                );

            incompleteInstallations.push({
                ...reservation,
                directoryState,
            });
        }

        const orphanedStagingDirectories:
            OrphanedPluginStagingDirectory[] = [];

        let names: string[];

        try {
            names = await readdir(storageRoot);
        } catch (error) {
            if (
                (error as NodeJS.ErrnoException).code ===
                'ENOENT'
            ) {
                return {
                    incompleteInstallations,
                    orphanedStagingDirectories,
                };
            }

            throw error;
        }

        for (const name of names) {
            if (
                !STAGING_DIRECTORY_PATTERN.test(name) ||
                basename(name) !== name
            ) {
                continue;
            }

            const directoryState =
                await inspectDirectory(
                    join(storageRoot, name),
                );

            orphanedStagingDirectories.push({
                name,
                directoryState:
                    directoryState === 'present'
                        ? 'directory'
                        : 'unexpected',
            });
        }

        return {
            incompleteInstallations,
            orphanedStagingDirectories,
        };
    };

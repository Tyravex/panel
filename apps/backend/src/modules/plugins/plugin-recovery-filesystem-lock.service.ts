import { Injectable, Logger } from '@nestjs/common';
import {
    lstat,
    mkdir,
    rmdir,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { getPluginStorageRoot } from './plugin-storage.config';

export interface PluginFilesystemLockResult<T> {
    acquired: boolean;
    result?: T;
}

@Injectable()
export class PluginRecoveryFilesystemLockService {
    private readonly logger = new Logger(
        PluginRecoveryFilesystemLockService.name,
    );

    async withLock<T>(
        operation: () => Promise<T>,
    ): Promise<PluginFilesystemLockResult<T>> {
        const root = resolve(getPluginStorageRoot());
        const lockDirectory = join(
            root,
            '.recovery.lock',
        );

        // Never create storage implicitly during recovery.
        const stats = await lstat(root).catch(() => null);

        if (
            !stats ||
            !stats.isDirectory() ||
            stats.isSymbolicLink()
        ) {
            throw new Error(
                'Plugin storage root is not a regular directory.',
            );
        }

        try {
            // mkdir without recursive mode is an atomic claim.
            await mkdir(lockDirectory, {
                mode: 0o700,
                recursive: false,
            });
        } catch (error) {
            if (
                (error as NodeJS.ErrnoException).code ===
                'EEXIST'
            ) {
                return {
                    acquired: false,
                };
            }

            throw error;
        }

        try {
            const result = await operation();

            return {
                acquired: true,
                result,
            };
        } finally {
            try {
                await rmdir(lockDirectory);
            } catch (error) {
                this.logger.error(
                    'Could not release plugin recovery filesystem lock.',
                );

                // Fail closed. Do not remove or replace the lock.
                throw error;
            }
        }
    }
}
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
    lstat,
    mkdir,
    readFile,
    readdir,
    rename,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';

import { getPluginStorageRoot } from './plugin-storage.config';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_MANIFEST_BYTES = 64 * 1024;

interface PluginManifestIdentity {
    id: string;
    version: string;
}

export interface PluginCleanupClaimReport {
    checked: number;
    claimed: number;
    skipped: number;
    failed: number;
}

@Injectable()
export class PluginCleanupClaimService {
    private readonly logger = new Logger(PluginCleanupClaimService.name);

    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async claimPending(): Promise<PluginCleanupClaimReport> {
        const report: PluginCleanupClaimReport = {
            checked: 0,
            claimed: 0,
            skipped: 0,
            failed: 0,
        };

        const root = resolve(getPluginStorageRoot());
        const quarantineRoot = join(root, '.uninstalling');
        const cleanupRoot = join(root, '.cleanup');

        if (!(await this.isRegularDirectory(root))) {
            this.logger.warn('Plugin storage root is unavailable.');
            return report;
        }

        if (!(await this.isRegularDirectory(quarantineRoot))) {
            return report;
        }

        try {
            await mkdir(cleanupRoot, {
                recursive: false,
                mode: 0o700,
            });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                this.logger.error('Could not create plugin cleanup root.');
                return report;
            }
        }

        if (!(await this.isRegularDirectory(cleanupRoot))) {
            this.logger.error('Plugin cleanup root is not a regular directory.');
            return report;
        }

        let entries: string[];

        try {
            entries = await readdir(quarantineRoot);
        } catch {
            this.logger.error('Could not read plugin quarantine directory.');
            return report;
        }

        for (const operationId of entries) {
            report.checked++;

            if (!UUID_PATTERN.test(operationId)) {
                report.skipped++;
                continue;
            }

            const source = join(quarantineRoot, operationId);

            try {
                if (!(await this.isRegularDirectory(source))) {
                    report.skipped++;
                    continue;
                }

                const manifest = await this.readManifest(source);

                if (!manifest) {
                    report.skipped++;
                    continue;
                }

                const completed = await this.isCompletedUninstall(
                    operationId,
                    manifest,
                );

                if (!completed) {
                    report.skipped++;
                    continue;
                }

                if (
                    !(await this.isRegularDirectory(quarantineRoot)) ||
                    !(await this.isRegularDirectory(cleanupRoot)) ||
                    !(await this.isRegularDirectory(source))
                ) {
                    report.skipped++;
                    continue;
                }

                const destination = join(
                    cleanupRoot,
                    `${operationId}-${randomUUID()}`,
                );

                /*
                 * The destination is unpredictable and unique per claim.
                 * No existing cleanup directory is intentionally reused.
                 */
                await rename(source, destination);

                report.claimed++;

                this.logger.log(
                    `Claimed completed plugin uninstall ${operationId}.`,
                );
            } catch (error) {
                if (
                    (error as NodeJS.ErrnoException).code === 'ENOENT'
                ) {
                    report.skipped++;
                    continue;
                }

                report.failed++;

                this.logger.error(
                    `Could not claim plugin uninstall ${operationId}.`,
                );
            }
        }

        return report;
    }

    private async isCompletedUninstall(
        operationId: string,
        manifest: PluginManifestIdentity,
    ): Promise<boolean> {
        const existingPlugin = await this.prisma.plugin.findUnique({
            where: {
                id: manifest.id,
            },
            select: {
                id: true,
            },
        });

        if (existingPlugin) {
            return false;
        }

        const audits = await this.prisma.adminAuditLog.findMany({
            where: {
                action: 'plugin.uninstalled',
                targetType: 'Plugin',
                targetId: manifest.id,
            },
            select: {
                metadata: true,
            },
        });

        return audits.some((audit) => {
            const metadata = audit.metadata;

            if (
                !metadata ||
                typeof metadata !== 'object' ||
                Array.isArray(metadata)
            ) {
                return false;
            }

            const values = metadata as Record<string, unknown>;

            return (
                values.operationId === operationId &&
                values.version === manifest.version
            );
        });
    }

    private async readManifest(
        directory: string,
    ): Promise<PluginManifestIdentity | null> {
        const packageDirectory = join(directory, 'package');
        const manifestPath = join(packageDirectory, 'manifest.json');

        if (!(await this.isRegularDirectory(packageDirectory))) {
            return null;
        }

        try {
            const stats = await lstat(manifestPath);

            if (
                !stats.isFile() ||
                stats.isSymbolicLink() ||
                stats.size > MAX_MANIFEST_BYTES
            ) {
                return null;
            }

            const contents = await readFile(manifestPath, 'utf8');
            const parsed: unknown = JSON.parse(contents);

            if (
                !parsed ||
                typeof parsed !== 'object' ||
                Array.isArray(parsed)
            ) {
                return null;
            }

            const manifest = parsed as Record<string, unknown>;

            if (
                typeof manifest.id !== 'string' ||
                typeof manifest.version !== 'string' ||
                manifest.id.length === 0 ||
                manifest.version.length === 0
            ) {
                return null;
            }

            return {
                id: manifest.id,
                version: manifest.version,
            };
        } catch {
            return null;
        }
    }

    private async isRegularDirectory(path: string): Promise<boolean> {
        try {
            const stats = await lstat(path);

            return stats.isDirectory() && !stats.isSymbolicLink();
        } catch {
            return false;
        }
    }
}
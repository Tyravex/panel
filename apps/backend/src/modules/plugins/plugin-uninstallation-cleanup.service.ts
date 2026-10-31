import { Injectable, Logger } from '@nestjs/common';
import { lstat, readdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';

import { getPluginStorageRoot } from './plugin-storage.config';

const UUID_SOURCE =
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const CLAIM_PATTERN = new RegExp(
    `^(${UUID_SOURCE})-(${UUID_SOURCE})$`,
    'i',
);

const MAX_MANIFEST_BYTES = 64 * 1024;

interface PluginManifestIdentity {
    id: string;
    version: string;
}

export interface PluginCleanupReport {
    checked: number;
    removed: number;
    skipped: number;
    failed: number;
}

@Injectable()
export class PluginUninstallationCleanupService {
    private readonly logger = new Logger(
        PluginUninstallationCleanupService.name,
    );

    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async cleanupCompleted(): Promise<PluginCleanupReport> {
        const report: PluginCleanupReport = {
            checked: 0,
            removed: 0,
            skipped: 0,
            failed: 0,
        };

        const root = resolve(getPluginStorageRoot());
        const cleanupRoot = join(root, '.cleanup');

        if (!(await this.isRegularDirectory(root))) {
            this.logger.warn(
                'Plugin storage root is unavailable.',
            );
            return report;
        }

        if (!(await this.isRegularDirectory(cleanupRoot))) {
            return report;
        }

        let entries: string[];

        try {
            entries = await readdir(cleanupRoot);
        } catch {
            this.logger.warn(
                'Could not read plugin cleanup directory.',
            );
            return report;
        }

        for (const entry of entries) {
            report.checked++;

            const match = CLAIM_PATTERN.exec(entry);

            if (!match) {
                report.skipped++;
                continue;
            }

            const operationId = match[1];
            const directory = join(cleanupRoot, entry);

            try {
                if (!(await this.isRegularDirectory(directory))) {
                    report.skipped++;
                    continue;
                }

                const manifest = await this.readManifest(directory);

                if (!manifest) {
                    report.skipped++;
                    continue;
                }

                if (
                    !(await this.isCompletedUninstall(
                        operationId,
                        manifest,
                    ))
                ) {
                    report.skipped++;
                    continue;
                }

                // Revalidate directory boundaries before deletion.
                if (
                    !(await this.isRegularDirectory(root)) ||
                    !(await this.isRegularDirectory(cleanupRoot)) ||
                    !(await this.isRegularDirectory(directory))
                ) {
                    report.skipped++;
                    continue;
                }

                await rm(directory, {
                    recursive: true,
                    force: false,
                });

                report.removed++;

                this.logger.log(
                    `Removed completed plugin cleanup operation ${operationId}.`,
                );
            } catch (error) {
                report.failed++;

                this.logger.error(
                    `Could not clean plugin uninstall ${operationId}: ${error instanceof Error
                        ? error.message
                        : 'Unknown error'
                    }`,
                );
            }
        }

        return report;
    }

    private async isCompletedUninstall(
        operationId: string,
        manifest: PluginManifestIdentity,
    ): Promise<boolean> {
        const existingPlugin =
            await this.prisma.plugin.findUnique({
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

        const audits =
            await this.prisma.adminAuditLog.findMany({
                where: {
                    action: 'plugin.uninstalled',
                    targetType: 'Plugin',
                    targetId: manifest.id,
                },
                select: {
                    targetId: true,
                    metadata: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: 100,
            });

        return audits.some((audit) => {
            if (audit.targetId !== manifest.id) {
                return false;
            }

            const metadata = audit.metadata;

            if (
                !metadata ||
                typeof metadata !== 'object' ||
                Array.isArray(metadata)
            ) {
                return false;
            }

            const values = metadata as Record<
                string,
                unknown
            >;

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

        if (!(await this.isRegularDirectory(packageDirectory))) {
            return null;
        }

        const manifestPath = join(
            packageDirectory,
            'manifest.json',
        );

        try {
            const stats = await lstat(manifestPath);

            if (
                !stats.isFile() ||
                stats.isSymbolicLink() ||
                stats.size > MAX_MANIFEST_BYTES
            ) {
                return null;
            }

            const contents = await readFile(
                manifestPath,
                'utf8',
            );

            if (
                Buffer.byteLength(contents, 'utf8') >
                MAX_MANIFEST_BYTES
            ) {
                return null;
            }

            const parsed: unknown = JSON.parse(contents);

            if (
                !parsed ||
                typeof parsed !== 'object' ||
                Array.isArray(parsed)
            ) {
                return null;
            }

            const candidate = parsed as Record<
                string,
                unknown
            >;

            if (
                typeof candidate.id !== 'string' ||
                typeof candidate.version !== 'string' ||
                candidate.id.trim().length === 0 ||
                candidate.version.trim().length === 0
            ) {
                return null;
            }

            return {
                id: candidate.id,
                version: candidate.version,
            };
        } catch {
            return null;
        }
    }

    private async isRegularDirectory(
        path: string,
    ): Promise<boolean> {
        try {
            const stats = await lstat(path);

            return (
                stats.isDirectory() &&
                !stats.isSymbolicLink()
            );
        } catch {
            return false;
        }
    }
}
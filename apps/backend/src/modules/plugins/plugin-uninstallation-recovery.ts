import { Injectable } from '@nestjs/common';
import { lstat, readdir, readFile } from 'node:fs/promises';
import {
    isAbsolute,
    join,
    resolve,
    sep,
} from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';

import { getPluginStorageRoot } from './plugin-storage.config';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_MANIFEST_BYTES = 64 * 1024;

export type PluginUninstallationRecoveryIssueType =
    | 'RESERVATION_WITH_SOURCE'
    | 'RESERVATION_WITHOUT_SOURCE'
    | 'QUARANTINE_CANDIDATE'
    | 'ORPHANED_QUARANTINE'
    | 'UNSAFE_QUARANTINE_ENTRY'
    | 'UNREADABLE_QUARANTINE'
    | 'INVALID_QUARANTINE_PACKAGE'
    | 'RESERVATION_WITH_QUARANTINE'
    | 'RESERVATION_WITH_BOTH_DIRECTORIES'
    | 'RESERVATION_WITHOUT_DIRECTORIES'
    | 'RESERVATION_WITHOUT_OPERATION_ID'
    | 'QUARANTINE_WITH_COMPLETED_AUDIT'
    | 'QUARANTINE_WITHOUT_COMPLETED_AUDIT'
    | 'QUARANTINE_IDENTITY_MISMATCH';

export interface PluginUninstallationRecoveryIssue {
    type: PluginUninstallationRecoveryIssueType;
    pluginId: string | null;
    directory: string | null;
    operationId?: string | null;
}

export interface PluginUninstallationRecoveryReport {
    checkedAt: string;
    issues: PluginUninstallationRecoveryIssue[];
    requiresManualReview: boolean;
}

interface UninstallReservation {
    id: string;
    version: string;
    storagePath: string;
    uninstallOperationId: string | null;
}

interface QuarantineManifest {
    id: string;
    version: string;
}

interface CompletedAudit {
    targetId: string;
    metadata: unknown;
}

@Injectable()
export class PluginUninstallationRecovery {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async inspect(): Promise<PluginUninstallationRecoveryReport> {
        const root = resolve(getPluginStorageRoot());
        const quarantineRoot = join(root, '.uninstalling');

        const issues: PluginUninstallationRecoveryIssue[] = [];

        const reservations = await this.prisma.plugin.findMany({
            where: {
                status: 'UNINSTALLING',
            },
            select: {
                id: true,
                version: true,
                storagePath: true,
                uninstallOperationId: true,
            },
        });

        const reservationsByOperation = new Map<
            string,
            UninstallReservation
        >();

        for (const reservation of reservations) {
            if (
                reservation.uninstallOperationId &&
                UUID_PATTERN.test(
                    reservation.uninstallOperationId,
                )
            ) {
                reservationsByOperation.set(
                    reservation.uninstallOperationId.toLowerCase(),
                    reservation,
                );
            }
        }

        const quarantineEntries =
            await this.readQuarantineEntries(
                quarantineRoot,
                issues,
            );

        const quarantineNames = new Set(
            quarantineEntries.map((entry) => entry.toLowerCase()),
        );

        for (const reservation of reservations) {
            const source = this.resolveSourceDirectory(
                root,
                reservation,
            );

            const sourceExists = source
                ? await this.isRegularDirectory(source)
                : false;

            const operationId =
                reservation.uninstallOperationId;

            if (
                !operationId ||
                !UUID_PATTERN.test(operationId)
            ) {
                issues.push({
                    type: 'RESERVATION_WITHOUT_OPERATION_ID',
                    pluginId: reservation.id,
                    directory: source,
                    operationId: operationId ?? null,
                });

                continue;
            }

            const quarantine = join(
                quarantineRoot,
                operationId,
            );

            const quarantineExists =
                quarantineNames.has(
                    operationId.toLowerCase(),
                ) &&
                (await this.isRegularDirectory(quarantine));

            if (sourceExists && quarantineExists) {
                issues.push({
                    type: 'RESERVATION_WITH_BOTH_DIRECTORIES',
                    pluginId: reservation.id,
                    directory: quarantine,
                    operationId,
                });

                continue;
            }

            if (quarantineExists) {
                issues.push({
                    type: 'RESERVATION_WITH_QUARANTINE',
                    pluginId: reservation.id,
                    directory: quarantine,
                    operationId,
                });

                continue;
            }

            if (sourceExists) {
                issues.push({
                    type: 'RESERVATION_WITH_SOURCE',
                    pluginId: reservation.id,
                    directory: source,
                    operationId,
                });

                continue;
            }

            issues.push({
                type: 'RESERVATION_WITHOUT_DIRECTORIES',
                pluginId: reservation.id,
                directory: null,
                operationId,
            });
        }

        for (const entry of quarantineEntries) {
            const directory = join(
                quarantineRoot,
                entry,
            );

            if (!UUID_PATTERN.test(entry)) {
                issues.push({
                    type: 'UNSAFE_QUARANTINE_ENTRY',
                    pluginId: null,
                    directory,
                    operationId: null,
                });

                continue;
            }

            if (!(await this.isRegularDirectory(directory))) {
                issues.push({
                    type: 'UNSAFE_QUARANTINE_ENTRY',
                    pluginId: null,
                    directory,
                    operationId: entry,
                });

                continue;
            }

            const manifest =
                await this.readQuarantinedManifest(directory);

            if (!manifest) {
                issues.push({
                    type: 'INVALID_QUARANTINE_PACKAGE',
                    pluginId: null,
                    directory,
                    operationId: entry,
                });

                continue;
            }

            const reservation =
                reservationsByOperation.get(entry.toLowerCase());

            if (reservation) {
                if (
                    manifest.id !== reservation.id ||
                    manifest.version !== reservation.version
                ) {
                    issues.push({
                        type: 'QUARANTINE_IDENTITY_MISMATCH',
                        pluginId: reservation.id,
                        directory,
                        operationId: entry,
                    });
                }

                continue;
            }

            const completedAudit =
                await this.findCompletedAudit(
                    entry,
                    manifest.id,
                );

            if (completedAudit) {
                issues.push({
                    type: 'QUARANTINE_WITH_COMPLETED_AUDIT',
                    pluginId: manifest.id,
                    directory,
                    operationId: entry,
                });
            } else {
                issues.push({
                    type: 'QUARANTINE_WITHOUT_COMPLETED_AUDIT',
                    pluginId: manifest.id,
                    directory,
                    operationId: entry,
                });
            }
        }

        return {
            checkedAt: new Date().toISOString(),
            issues,
            requiresManualReview: issues.length > 0,
        };
    }

    private async readQuarantineEntries(
        quarantineRoot: string,
        issues: PluginUninstallationRecoveryIssue[],
    ): Promise<string[]> {
        try {
            const stats = await lstat(quarantineRoot);

            if (
                !stats.isDirectory() ||
                stats.isSymbolicLink()
            ) {
                issues.push({
                    type: 'UNSAFE_QUARANTINE_ENTRY',
                    pluginId: null,
                    directory: quarantineRoot,
                    operationId: null,
                });

                return [];
            }

            return await readdir(quarantineRoot);
        } catch (error) {
            if (this.isNotFound(error)) {
                return [];
            }

            issues.push({
                type: 'UNREADABLE_QUARANTINE',
                pluginId: null,
                directory: quarantineRoot,
                operationId: null,
            });

            return [];
        }
    }

    private resolveSourceDirectory(
        root: string,
        reservation: UninstallReservation,
    ): string | null {
        const storagePath = reservation.storagePath;

        if (
            !storagePath ||
            isAbsolute(storagePath) ||
            storagePath.includes('\\')
        ) {
            return null;
        }

        const segments = storagePath.split('/');

        if (
            segments.length !== 2 ||
            segments[1] !== 'package'
        ) {
            return null;
        }

        const prefix = `${reservation.id}-`;

        if (
            !segments[0].startsWith(prefix) ||
            !UUID_PATTERN.test(
                segments[0].slice(prefix.length),
            )
        ) {
            return null;
        }

        const directory = resolve(
            root,
            segments[0],
        );

        if (
            directory === root ||
            !directory.startsWith(`${root}${sep}`)
        ) {
            return null;
        }

        return directory;
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

    private async readQuarantinedManifest(
        directory: string,
    ): Promise<QuarantineManifest | null> {
        try {
            const packageDirectory = join(
                directory,
                'package',
            );

            if (
                !(await this.isRegularDirectory(
                    packageDirectory,
                ))
            ) {
                return null;
            }

            const manifestPath = join(
                packageDirectory,
                'manifest.json',
            );

            const stats = await lstat(manifestPath);

            if (
                !stats.isFile() ||
                stats.isSymbolicLink() ||
                stats.size > MAX_MANIFEST_BYTES
            ) {
                return null;
            }

            const raw = await readFile(
                manifestPath,
                'utf8',
            );

            const parsed: unknown = JSON.parse(raw);

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
                typeof candidate.version !== 'string'
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

    private async findCompletedAudit(
        operationId: string,
        pluginId: string,
    ): Promise<boolean> {
        const audits =
            await this.prisma.adminAuditLog.findMany({
                where: {
                    action: 'plugin.uninstalled',
                    targetType: 'Plugin',
                    targetId: pluginId,
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

        return audits.some((audit: CompletedAudit) => {
            if (
                !audit.metadata ||
                typeof audit.metadata !== 'object' ||
                Array.isArray(audit.metadata)
            ) {
                return false;
            }

            const metadata = audit.metadata as Record<
                string,
                unknown
            >;

            return (
                audit.targetId === pluginId &&
                metadata.operationId === operationId
            );
        });
    }

    private isNotFound(error: unknown): boolean {
        return (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'ENOENT'
        );
    }
}
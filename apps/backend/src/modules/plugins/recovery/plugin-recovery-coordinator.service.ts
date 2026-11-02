import { Injectable, Logger } from '@nestjs/common';

import {
    PluginCleanupClaimService,
    type PluginCleanupClaimReport,
} from './plugin-cleanup-claim.service';

import {
    PluginUninstallationCleanupService,
    type PluginCleanupReport,
} from './plugin-uninstallation-cleanup.service';

import { PluginRecoveryFilesystemLockService } from './plugin-recovery-filesystem-lock.service';

export interface PluginRecoveryRunReport {
    acquired: boolean;
    claim?: PluginCleanupClaimReport;
    cleanup?: PluginCleanupReport;
}

@Injectable()
export class PluginRecoveryCoordinatorService {
    private readonly logger = new Logger(
        PluginRecoveryCoordinatorService.name,
    );

    constructor(
        private readonly filesystemLock:
            PluginRecoveryFilesystemLockService,
        private readonly claimService:
            PluginCleanupClaimService,
        private readonly cleanupService:
            PluginUninstallationCleanupService,
    ) { }

    async runOnce(): Promise<PluginRecoveryRunReport> {
        const locked = await this.filesystemLock.withLock(
            async () => {
                const claim =
                    await this.claimService.claimPending();

                const cleanup =
                    await this.cleanupService.cleanupCompleted();

                return {
                    claim,
                    cleanup,
                };
            },
        );

        if (!locked.acquired) {
            this.logger.warn(
                'Plugin recovery skipped: another process holds the filesystem lock.',
            );

            return {
                acquired: false,
            };
        }

        if (!locked.result) {
            throw new Error(
                'Plugin recovery completed without a result.',
            );
        }

        return {
            acquired: true,
            ...locked.result,
        };
    }
}
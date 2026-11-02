import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';

/**
 * Dedicated PostgreSQL advisory lock key for plugin recovery.
 *
 * All backend instances must use the same key.
 */
const PLUGIN_RECOVERY_LOCK_KEY = 742010001;

export interface PluginRecoveryLockResult<T> {
    acquired: boolean;
    result?: T;
}

@Injectable()
export class PluginRecoveryLockService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async withLock<T>(
        operation: (
            tx: Prisma.TransactionClient,
        ) => Promise<T>,
    ): Promise<PluginRecoveryLockResult<T>> {
        return this.prisma.$transaction(
            async (tx) => {
                const rows = await tx.$queryRaw<
                    Array<{ acquired: boolean }>
                >`
          SELECT pg_try_advisory_xact_lock(
            ${PLUGIN_RECOVERY_LOCK_KEY}
          ) AS acquired
        `;

                if (rows[0]?.acquired !== true) {
                    return {
                        acquired: false,
                    };
                }

                const result = await operation(tx);

                return {
                    acquired: true,
                    result,
                };
            },
            {
                maxWait: 5000,
                timeout: 10000,
                isolationLevel:
                    Prisma.TransactionIsolationLevel.ReadCommitted,
            },
        );
    }
}
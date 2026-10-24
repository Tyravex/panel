import { AgentCommandStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { AgentCommandsService } from './agent-commands.service';

/**
 * Minimal database contract for recovering commands whose execution
 * outcome became uncertain after a backend process stopped.
 *
 * The recovery process must never re-dispatch an existing command.
 */
export type AgentCommandRecoveryDatabase = Pick<
    PrismaService,
    'agentCommand'
>;

export type AgentCommandRecoveryResult = {
    scanned: number;
    markedUnknown: number;
    skipped: number;
    failed: number;
};

const RECOVERY_BATCH_SIZE = 100;

/**
 * Recovers commands left in SENT or ACCEPTED after a backend restart.
 *
 * SENT means the Panel claimed a send attempt. It does not prove
 * that the Agent received the command.
 *
 * ACCEPTED means the Agent acknowledged the command. It does not
 * prove that execution finished.
 *
 * Both states must therefore become UNKNOWN during recovery.
 *
 * This service intentionally does not send commands to Agents,
 * change Jobs or retry operations.
 */
export class AgentCommandRecoveryService {
    constructor(
        private readonly database: AgentCommandRecoveryDatabase,
        private readonly commandsService: AgentCommandsService,
    ) {}

    /**
     * Reconciles one batch of uncertain commands.
     *
     * This method should be called only after active transport
     * sessions have been stopped, or during backend startup before
     * the WebSocket transport begins accepting connections.
     *
     * Do not run it concurrently with active command execution.
     */
    async recoverBatch(): Promise<AgentCommandRecoveryResult> {
        const records = await this.database.agentCommand.findMany({
            where: {
                status: {
                    in: [
                        AgentCommandStatus.SENT,
                        AgentCommandStatus.ACCEPTED,
                    ],
                },
            },
            select: {
                id: true,
            },
            take: RECOVERY_BATCH_SIZE,
            orderBy: {
                preparedAt: 'asc',
            },
        });

        const result: AgentCommandRecoveryResult = {
            scanned: records.length,
            markedUnknown: 0,
            skipped: 0,
            failed: 0,
        };

        for (const record of records) {
            try {
                // markUnknown() performs a conditional database update.
                // It must not overwrite COMPLETED, FAILED or UNKNOWN.
                const changed =
                    await this.commandsService.markUnknown(record.id);

                if (changed) {
                    result.markedUnknown += 1;
                } else {
                    result.skipped += 1;
                }
            } catch {
                // Do not discard database failures.
                // The command remains eligible for a later recovery.
                result.failed += 1;
            }
        }

        return result;
    }

    /**
     * Recovers all batches until no active uncertain commands remain.
     *
     * Failures stop the loop, preventing endless processing of
     * records that could not be updated.
     *
     * Concurrent recovery workers are not supported by this method.
     */
    async recoverAll(): Promise<AgentCommandRecoveryResult> {
        const total: AgentCommandRecoveryResult = {
            scanned: 0,
            markedUnknown: 0,
            skipped: 0,
            failed: 0,
        };

        while (true) {
            const batch = await this.recoverBatch();

            total.scanned += batch.scanned;
            total.markedUnknown += batch.markedUnknown;
            total.skipped += batch.skipped;
            total.failed += batch.failed;

            if (batch.failed > 0) {
                throw new Error(
                    'Agent command recovery failed: ' +
                    `${batch.failed} command update(s) failed`,
                );
            }

            if (batch.scanned === 0) {
                return total;
            }

            // A full batch may contain records changed concurrently
            // by another process. Stop if no progress was possible.
            if (batch.markedUnknown === 0) {
                throw new Error(
                    'Agent command recovery made no progress',
                );
            }
        }
    }
}

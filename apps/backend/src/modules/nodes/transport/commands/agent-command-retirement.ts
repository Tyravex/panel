import { AgentCommandsService } from './agent-commands.service';
import {
    AgentPendingCommands,
    type PendingAgentCommand,
} from './agent-pending-commands';

export class AgentCommandRetirement {
    constructor(
        private readonly pendingCommands: AgentPendingCommands,
        private readonly agentCommandsService:
            AgentCommandsService | undefined,
    ) { }

    /**
     * Marks uncertain command outcomes without retrying them.
     *
     * The database transition is conditional: COMPLETED and FAILED
     * cannot be overwritten by UNKNOWN.
     *
     * A failed database write must be reconciled later by a
     * database-backed recovery worker.
     */
    retireCommands(commands: PendingAgentCommand[]): void {
        if (!this.agentCommandsService) {
            return;
        }

        for (const command of commands) {
            void this.agentCommandsService
                .markUnknown(command.commandId)
                .catch((error: unknown) => {
                    console.error(
                        'Failed to mark Agent command UNKNOWN',
                        {
                            commandId: command.commandId,
                            error,
                        },
                    );
                });
        }
    }

    /**
     * Removes all in-memory commands from a disconnected session.
     *
     * Losing a WebSocket connection is not evidence that the
     * Agent stopped or failed the operation.
     */
    retireSessionCommands(sessionId: string): void {
        const removed =
            this.pendingCommands.drainSession(sessionId);

        this.retireCommands(removed);
    }
}
import { WebSocket } from 'ws';

import { AgentPendingCommands } from '../commands/agent-pending-commands';
import { AgentCommandsService } from '../commands/agent-commands.service';
import { AgentSessionRegistry } from '../sessions/agent-session-registry';
import {
    COMMAND_RESPONSE_TIMEOUT_MS,
    HEARTBEAT_TIMEOUT_MS,
} from '../websocket/agent-websocket.constants';

export class AgentWebSocketSessionMonitor {
    constructor(
        private readonly sessions: AgentSessionRegistry,
        private readonly pendingCommands: AgentPendingCommands,
        private readonly agentCommandsService:
            AgentCommandsService | undefined,
    ) { }

    checkSessions(): void {
        const now = Date.now();

        // Expiration does NOT mean the Agent stopped executing.
        // A timeout creates an uncertain outcome, not a retry.
        const expired = this.pendingCommands.expire(
            now,
            COMMAND_RESPONSE_TIMEOUT_MS,
        );

        this.retireCommands(expired);

        for (const session of this.sessions.values()) {
            const { socket } = session;

            if (socket.readyState !== WebSocket.OPEN) {
                continue;
            }

            if (
                now - session.lastHeartbeat >
                HEARTBEAT_TIMEOUT_MS
            ) {
                socket.terminate();
                continue;
            }

            if (session.awaitingPong) {
                socket.terminate();
                continue;
            }

            session.awaitingPong = true;
            socket.ping();
        }
    }

    private retireCommands(
        commands: ReturnType<AgentPendingCommands['expire']>,
    ): void {
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
}
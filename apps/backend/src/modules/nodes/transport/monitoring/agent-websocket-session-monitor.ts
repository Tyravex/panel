import { WebSocket } from 'ws';

import { AgentCommandRetirement } from '../commands/agent-command-retirement';
import { AgentPendingCommands } from '../commands/agent-pending-commands';
import { AgentSessionRegistry } from '../sessions/agent-session-registry';
import {
    COMMAND_RESPONSE_TIMEOUT_MS,
    HEARTBEAT_TIMEOUT_MS,
} from '../websocket/agent-websocket.constants';

export class AgentWebSocketSessionMonitor {
    constructor(
        private readonly sessions: AgentSessionRegistry,
        private readonly pendingCommands: AgentPendingCommands,
        private readonly commandRetirement: AgentCommandRetirement,
    ) { }

    checkSessions(): void {
        const now = Date.now();

        // Expiration does NOT mean the Agent stopped executing.
        // A timeout creates an uncertain outcome, not a retry.
        const expired = this.pendingCommands.expire(
            now,
            COMMAND_RESPONSE_TIMEOUT_MS,
        );

        this.commandRetirement.retireCommands(expired);

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
}
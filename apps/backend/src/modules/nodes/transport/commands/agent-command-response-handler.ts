import { WebSocket } from 'ws';

import type { AgentToPanelMessage } from '../../protocol/agent-direction';
import { AgentSessionRegistry } from '../sessions/agent-session-registry';
import type { AgentSession } from '../sessions/agent-session.types';
import { AgentCommandsService } from './agent-commands.service';
import { AgentPendingCommands } from './agent-pending-commands';

type CommandResponseMessage = AgentToPanelMessage;

export class AgentCommandResponseHandler {
    constructor(
        private readonly sessions: AgentSessionRegistry,
        private readonly pendingCommands: AgentPendingCommands,
        private readonly agentCommandsService:
            AgentCommandsService | undefined,
    ) { }

    async handle(
        session: AgentSession,
        message: CommandResponseMessage,
    ): Promise<void> {
        const { socket } = session;

        // Ignore responses from a connection that has been replaced.
        if (
            !this.sessions.isCurrent(session) ||
            socket.readyState !== WebSocket.OPEN
        ) {
            return;
        }

        const commandId = message.payload.commandId;

        if (typeof commandId !== 'string') {
            socket.close(1008, 'Invalid command ID');
            return;
        }

        // Responses must match the exact command, node and session.
        const pending = this.pendingCommands.find(commandId);

        if (
            !pending ||
            pending.sessionId !== session.sessionId ||
            pending.nodeId !== session.nodeId
        ) {
            socket.close(1008, 'Unexpected command response');
            return;
        }

        if (message.type === 'command.accepted') {
            if (this.agentCommandsService) {
                // Persist before updating in-memory acknowledgement.
                const persisted =
                    await this.agentCommandsService.markAccepted(
                        commandId,
                        session.sessionId,
                    );

                if (!persisted) {
                    socket.close(
                        1008,
                        'Unexpected command acceptance',
                    );
                    return;
                }
            }

            if (
                !this.sessions.isCurrent(session) ||
                socket.readyState !== WebSocket.OPEN
            ) {
                return;
            }

            const status = this.pendingCommands.accept(
                commandId,
                session.sessionId,
            );

            if (status !== 'accepted') {
                socket.close(
                    1008,
                    'Unexpected command acceptance',
                );
            }

            return;
        }

        const { success, errorCode } = message.payload;

        if (
            typeof success !== 'boolean' ||
            (
                errorCode !== undefined &&
                typeof errorCode !== 'string'
            )
        ) {
            socket.close(1008, 'Invalid command result');
            return;
        }

        if (this.agentCommandsService) {
            // Only structured status and sanitized error codes
            // are stored. Agent message/result may contain secrets.
            const persisted =
                await this.agentCommandsService.markResult(
                    commandId,
                    session.sessionId,
                    success,
                    errorCode,
                );

            if (!persisted) {
                socket.close(1008, 'Unexpected command result');
                return;
            }
        }

        // A result may arrive without command.accepted.
        // Remove memory only after the database transition.
        this.pendingCommands.complete(
            commandId,
            session.sessionId,
        );

        // Job state synchronization is a separate phase.
    }
}
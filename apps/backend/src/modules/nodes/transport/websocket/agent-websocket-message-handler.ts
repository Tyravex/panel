import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';

import { NodesService } from '../../nodes.service';
import { isAgentToPanelMessage } from '../../protocol/agent-direction';
import { createAgentEnvelope } from '../../protocol/agent-protocol';
import { AgentCommandsService } from '../commands/agent-commands.service';
import { AgentPendingCommands } from '../commands/agent-pending-commands';
import { OwnershipSessionController } from '../ownership/ownership-session.controller';
import { AgentSessionRegistry } from '../sessions/agent-session-registry';
import type { AgentSession } from '../sessions/agent-session.types';

export class AgentWebSocketMessageHandler {
    constructor(
        private readonly nodesService: NodesService,
        private readonly sessions: AgentSessionRegistry,
        private readonly ownershipSessions: OwnershipSessionController,
        private readonly pendingCommands: AgentPendingCommands,
        private readonly agentCommandsService: AgentCommandsService | undefined,
        private readonly isClosed: () => boolean,
        private readonly sendInitialOwnershipSnapshot: (
            session: AgentSession,
        ) => Promise<void>,
    ) { }

    async processMessage(
        session: AgentSession,
        raw: string,
    ): Promise<void> {
        const { socket } = session;

        let message: unknown;

        try {
            message = JSON.parse(raw);
        } catch {
            socket.close(1007, 'Invalid JSON');
            return;
        }

        if (!isAgentToPanelMessage(message)) {
            socket.close(1008, 'Invalid protocol message');
            return;
        }

        if (!session.ready) {
            if (message.type !== 'node.hello') {
                socket.close(1008, 'Hello required');
                return;
            }

            if (
                this.isClosed() ||
                !this.sessions.isCurrent(session) ||
                socket.readyState !== WebSocket.OPEN
            ) {
                return;
            }

            session.ready = true;
            clearTimeout(session.helloTimer);

            this.ownershipSessions.activate(session);

            this.send(socket, 'node.welcome', {
                nodeId: session.nodeId,
                heartbeatIntervalSeconds: 30,
                sessionId: session.sessionId,
            });

            // Database access must not block heartbeat processing.
            void this.sendInitialOwnershipSnapshot(session);

            return;
        }

        if (message.type === 'node.heartbeat') {
            let result: Awaited<
                ReturnType<NodesService['heartbeat']>
            >;

            try {
                result = await this.nodesService.heartbeat(
                    session.nodeId,
                    session.token,
                );
            } catch {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.close(1011, 'Heartbeat processing failed');
                }

                return;
            }

            if (
                socket.readyState !== WebSocket.OPEN ||
                !this.sessions.isCurrent(session)
            ) {
                return;
            }

            if (!result?.ok) {
                socket.close(1008, 'Node authentication expired');
                return;
            }

            session.lastHeartbeat = Date.now();

            this.send(socket, 'node.heartbeat.ack', {});
            return;
        }

        if (
            message.type === 'command.accepted' ||
            message.type === 'command.result'
        ) {
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
            return;
        }

        socket.close(1008, 'Unsupported message in this phase');
    }

    private send(
        socket: WebSocket,
        type: 'node.welcome' | 'node.heartbeat.ack',
        payload: Record<string, unknown>,
    ): void {
        if (socket.readyState !== WebSocket.OPEN) {
            return;
        }

        socket.send(
            JSON.stringify(
                createAgentEnvelope(
                    type,
                    payload,
                    randomUUID(),
                ),
            ),
        );
    }
}
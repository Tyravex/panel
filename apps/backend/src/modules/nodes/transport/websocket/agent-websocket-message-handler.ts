import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';

import { NodesService } from '../../nodes.service';
import { isAgentToPanelMessage } from '../../protocol/agent-direction';
import { createAgentEnvelope } from '../../protocol/agent-protocol';
import { AgentCommandResponseHandler } from '../commands/agent-command-response-handler';
import { AgentCommandsService } from '../commands/agent-commands.service';
import { AgentPendingCommands } from '../commands/agent-pending-commands';
import { OwnershipSessionController } from '../ownership/ownership-session.controller';
import { AgentSessionRegistry } from '../sessions/agent-session-registry';
import type { AgentSession } from '../sessions/agent-session.types';

export class AgentWebSocketMessageHandler {
    private readonly commandResponseHandler: AgentCommandResponseHandler;

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
    ) {
        this.commandResponseHandler = new AgentCommandResponseHandler(
            this.sessions,
            this.pendingCommands,
            this.agentCommandsService,
        );
    }

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
            await this.commandResponseHandler.handle(
                session,
                message,
            );

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
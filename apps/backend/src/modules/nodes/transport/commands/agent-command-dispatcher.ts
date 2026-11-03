import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';

import {
    AgentCommandPayload,
    createAgentEnvelope,
} from '../../protocol/agent-protocol';
import { isValidAgentPayload } from '../../protocol/agent-payload';
import { AgentSessionRegistry } from '../sessions/agent-session-registry';
import { AgentCommandsService } from './agent-commands.service';
import { AgentPendingCommands } from './agent-pending-commands';

export class AgentCommandDispatcher {
    constructor(
        private readonly sessions: AgentSessionRegistry,
        private readonly pendingCommands: AgentPendingCommands,
        private readonly agentCommandsService:
            AgentCommandsService | undefined,
        private readonly isNodeConnected: (nodeId: string) => boolean,
        private readonly isClosed: () => boolean,
    ) { }

    /**
     * Legacy in-memory transport method.
     *
     * Disabled when durable command tracking is configured.
     * Do not use for real INSTALL dispatching.
     */
    sendCommand(
        nodeId: string,
        command: AgentCommandPayload,
    ): boolean {
        // Never permit the legacy path to bypass durable claimSend().
        if (this.agentCommandsService) {
            return false;
        }

        if (!this.isNodeConnected(nodeId)) {
            return false;
        }

        if (!isValidAgentPayload('command.execute', command)) {
            return false;
        }

        const session = this.sessions.get(nodeId);

        if (
            !session ||
            !session.ready ||
            session.socket.readyState !== WebSocket.OPEN
        ) {
            return false;
        }

        if (
            command.operation === 'service.install' &&
            command.parameters.nodeId !== nodeId
        ) {
            return false;
        }

        const registered = this.pendingCommands.register({
            commandId: command.commandId,
            nodeId,
            serviceId: command.serviceId,
            operation: command.operation,
            sessionId: session.sessionId,
            createdAt: Date.now(),
        });

        if (!registered) {
            return false;
        }

        try {
            const envelope = createAgentEnvelope(
                'command.execute',
                {
                    commandId: command.commandId,
                    operation: command.operation,
                    serviceId: command.serviceId,
                    parameters: command.parameters,
                },
                randomUUID(),
            );

            session.socket.send(JSON.stringify(envelope));

            return true;
        } catch {
            this.pendingCommands.remove(
                command.commandId,
                session.sessionId,
            );

            return false;
        }
    }

    /**
     * Sends a command whose identity already exists in PostgreSQL.
     *
     * The durable claim is committed before socket.send().
     * A claimed command is never automatically sent a second time,
     * even if the socket operation fails or the backend restarts.
     *
     * true means a WebSocket send was attempted, not that the
     * Agent accepted or completed the operation.
     */
    async sendDurableCommand(
        nodeId: string,
        command: AgentCommandPayload,
    ): Promise<boolean> {
        if (!this.agentCommandsService) {
            return false;
        }

        if (!this.isNodeConnected(nodeId)) {
            return false;
        }

        if (!isValidAgentPayload('command.execute', command)) {
            return false;
        }

        const session = this.sessions.get(nodeId);

        if (
            !session ||
            !session.ready ||
            session.socket.readyState !== WebSocket.OPEN
        ) {
            return false;
        }

        if (
            command.operation === 'service.install' &&
            command.parameters.nodeId !== nodeId
        ) {
            return false;
        }

        // The protocol commandId must be the database primary key.
        // This prevents a valid claim from authorizing a different
        // operation, service or node.
        const stored =
            await this.agentCommandsService.findById(
                command.commandId,
            );

        if (
            !stored ||
            stored.nodeId !== nodeId ||
            stored.serviceId !== command.serviceId ||
            stored.operation !== command.operation
        ) {
            return false;
        }

        // Check memory before claiming the only transport attempt.
        // This is an optimization, not the durable uniqueness guard.
        if (this.pendingCommands.find(command.commandId)) {
            return false;
        }

        // Atomically claim the command in PostgreSQL BEFORE sending.
        // If this fails, the socket must not be used.
        const claimed =
            await this.agentCommandsService.claimSend(
                command.commandId,
                session.sessionId,
            );

        if (!claimed) {
            return false;
        }

        // The claim is durable. From here, any uncertainty must be
        // represented as UNKNOWN, never as a new PREPARED attempt.
        if (
            this.sessions.get(nodeId) !== session ||
            session.socket.readyState !== WebSocket.OPEN ||
            !session.ready ||
            this.isClosed()
        ) {
            await this.agentCommandsService.markUnknown(
                command.commandId,
            );

            return false;
        }

        const registered = this.pendingCommands.register({
            commandId: command.commandId,
            nodeId,
            serviceId: command.serviceId,
            operation: command.operation,
            sessionId: session.sessionId,
            createdAt: Date.now(),
        });

        if (!registered) {
            await this.agentCommandsService.markUnknown(
                command.commandId,
            );

            return false;
        }

        try {
            const envelope = createAgentEnvelope(
                'command.execute',
                {
                    commandId: command.commandId,
                    operation: command.operation,
                    serviceId: command.serviceId,
                    parameters: command.parameters,
                },
                randomUUID(),
            );

            session.socket.send(JSON.stringify(envelope));

            // This only confirms a synchronous send attempt.
            // Agent acceptance is persisted by the message handler.
            return true;
        } catch {
            this.pendingCommands.remove(
                command.commandId,
                session.sessionId,
            );

            await this.agentCommandsService.markUnknown(
                command.commandId,
            );

            return false;
        }
    }
}
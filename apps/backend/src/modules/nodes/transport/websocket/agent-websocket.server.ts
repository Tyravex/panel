import { randomUUID } from 'node:crypto';
import { IncomingMessage, Server as HttpServer } from 'node:http';
import { Socket } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';

import { NodesService } from '../../nodes.service';
import { isAgentToPanelMessage } from '../../protocol/agent-direction';
import {
    AgentCommandPayload,
    createAgentEnvelope,
} from '../../protocol/agent-protocol';
import { isValidAgentPayload } from '../../protocol/agent-payload';
import { AgentCommandsService } from '../commands/agent-commands.service';
import {
    AgentPendingCommands,
    PendingAgentCommand,
} from '../commands/agent-pending-commands';
import { OwnershipSnapshotBuilder } from '../ownership/ownership-snapshot.builder';
import { OwnershipSessionController } from '../ownership/ownership-session.controller';
import { AgentWebSocketAuth } from './agent-websocket-auth';

import type { AgentSession } from '../sessions/agent-session.types';
import { AgentSessionRegistry } from '../sessions/agent-session-registry';
import { AgentWebSocketMessageHandler } from './agent-websocket-message-handler';

import {
    WS_PATH,
    MAX_MESSAGE_BYTES,
    MAX_PENDING_AUTH,
    AUTH_TIMEOUT_MS,
    HELLO_TIMEOUT_MS,
    HEARTBEAT_TIMEOUT_MS,
    COMMAND_RESPONSE_TIMEOUT_MS,
    PING_INTERVAL_MS,
    OWNERSHIP_REFRESH_INTERVAL_MS,
    OWNERSHIP_BUILD_TIMEOUT_MS,
} from './agent-websocket.constants';

type Session = AgentSession;

export class AgentWebSocketServer {
    private readonly wss = new WebSocketServer({
        noServer: true,
        maxPayload: MAX_MESSAGE_BYTES,
        perMessageDeflate: false,
    });

    private readonly messageHandler: AgentWebSocketMessageHandler;
    private readonly auth: AgentWebSocketAuth;
    private readonly sessions = new AgentSessionRegistry();
    private readonly pendingCommands = new AgentPendingCommands();
    private readonly pendingSockets = new Set<Socket>();
    private readonly ownershipSessions: OwnershipSessionController;

    private readonly heartbeatTimer: NodeJS.Timeout;
    private readonly ownershipRefreshTimer: NodeJS.Timeout;
    private closed = false;

    private readonly onUpgrade = (
        request: IncomingMessage,
        socket: Socket,
        head: Buffer,
    ): void => {
        let url: URL;

        try {
            url = new URL(request.url ?? '/', 'http://localhost');
        } catch {
            socket.destroy();
            return;
        }

        if (url.pathname !== WS_PATH) {
            return;
        }

        if (this.closed) {
            this.reject(socket, 503, 'Service Unavailable');
            return;
        }

        if (this.pendingSockets.size >= MAX_PENDING_AUTH) {
            this.reject(socket, 503, 'Service Unavailable');
            return;
        }

        this.pendingSockets.add(socket);

        void this.auth.authenticateAndUpgrade(
            request,
            socket,
            head,
        ).catch(() => {
            this.reject(socket, 401, 'Unauthorized');
        });
    };

    private readonly onUpgradeAfterClose = (
        request: IncomingMessage,
        socket: Socket,
    ): void => {
        let url: URL;

        try {
            url = new URL(request.url ?? '/', 'http://localhost');
        } catch {
            socket.destroy();
            return;
        }

        if (url.pathname === WS_PATH) {
            this.reject(socket, 503, 'Service Unavailable');
        }
    };

    constructor(
        private readonly httpServer: HttpServer,
        private readonly nodesService: NodesService,
        private readonly agentCommandsService?: AgentCommandsService,
    ) {
        this.ownershipSessions = new OwnershipSessionController(
            new OwnershipSnapshotBuilder(this.nodesService),
        );

        this.auth = new AgentWebSocketAuth(
            this.nodesService,
            this.wss,
            this.pendingSockets,
            () => this.closed,
            (socket, status, reason) => {
                this.reject(socket, status, reason);
            },
            (nodeId, token, socket) => {
                this.acceptConnection(nodeId, token, socket);
            },
        );

        this.messageHandler = new AgentWebSocketMessageHandler(
            this.nodesService,
            this.sessions,
            this.ownershipSessions,
            this.pendingCommands,
            this.agentCommandsService,
            () => this.closed,
            (session) => this.sendInitialOwnershipSnapshot(session),
        );

        this.httpServer.on('upgrade', this.onUpgrade);

        this.httpServer.once('close', () => {
            this.httpServer.off(
                'upgrade',
                this.onUpgradeAfterClose,
            );
        });

        this.heartbeatTimer = setInterval(() => {
            this.checkSessions();
        }, PING_INTERVAL_MS);

        this.heartbeatTimer.unref();

        this.ownershipRefreshTimer = setInterval(() => {
            this.refreshOwnershipSnapshots();
        }, OWNERSHIP_REFRESH_INTERVAL_MS);

        this.ownershipRefreshTimer.unref();
    }

    private reject(
        socket: Socket,
        status: number,
        reason: string,
    ): void {
        if (socket.destroyed) {
            return;
        }

        socket.end(
            `HTTP/1.1 ${status} ${reason}\r\n` +
            'Connection: close\r\n' +
            'Cache-Control: no-store\r\n' +
            'Content-Length: 0\r\n' +
            '\r\n',
        );
    }

    private acceptConnection(
        nodeId: string,
        token: string,
        socket: WebSocket,
    ): void {
        if (this.closed) {
            socket.terminate();
            return;
        }

        const previous = this.sessions.get(nodeId);

        if (previous) {
            this.ownershipSessions.revoke(previous);
            this.retireSessionCommands(previous.sessionId);
            previous.socket.terminate();
        }

        const session: Session = {
            sessionId: randomUUID(),
            nodeId,
            token,
            socket,
            ready: false,
            processing: false,
            lastHeartbeat: Date.now(),
            awaitingPong: false,
            ownershipRefreshPending: false,
            helloTimer: setTimeout(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.close(1008, 'Hello timeout');
                }
            }, HELLO_TIMEOUT_MS),
        };

        session.helloTimer.unref();

        this.sessions.set(session);

        socket.on('pong', () => {
            session.awaitingPong = false;
        });

        socket.on('message', (data, isBinary) => {
            if (isBinary) {
                socket.close(1003, 'Binary messages unsupported');
                return;
            }

            if (session.processing) {
                socket.close(1008, 'Concurrent message');
                return;
            }

            session.processing = true;

            void this.messageHandler.processMessage(
                session,
                data.toString('utf8'),
            )
                .catch(() => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.close(1011, 'Internal server error');
                    }
                })
                .finally(() => {
                    session.processing = false;
                });
        });

        socket.on('close', () => {
            clearTimeout(session.helloTimer);

            this.ownershipSessions.revoke(session);
            this.retireSessionCommands(session.sessionId);

            this.sessions.deleteIfCurrent(session);
        });

        socket.on('error', () => {
            socket.terminate();
        });
    }

    // Public temporarily for deterministic ownership refresh tests.
    refreshOwnershipSnapshots(): void {
        if (this.closed) {
            return;
        }

        for (const session of this.sessions.values()) {
            if (
                !session.ready ||
                session.socket.readyState !== WebSocket.OPEN ||
                !this.ownershipSessions.isActive(session)
            ) {
                continue;
            }

            void this.sendInitialOwnershipSnapshot(session);
        }
    }

    private async sendInitialOwnershipSnapshot(
        session: Session,
    ): Promise<void> {
        if (session.ownershipRefreshPending) {
            return;
        }

        session.ownershipRefreshPending = true;

        try {
            let timeout: NodeJS.Timeout | undefined;

            // Promise.race does not cancel Prisma. A late result must never
            // escape the session fence or be sent after the deadline.
            const build = this.ownershipSessions.build(session);
            const deadline = new Promise<never>((_resolve, reject) => {
                timeout = setTimeout(() => {
                    reject(new Error('Ownership snapshot build timed out'));
                }, OWNERSHIP_BUILD_TIMEOUT_MS);
                timeout.unref();
            });

            let message: string | null;
            try {
                message = await Promise.race([build, deadline]);
            } finally {
                if (timeout) {
                    clearTimeout(timeout);
                }
            }

            if (message === null) {
                return;
            }

            // No await between the session fence and the socket send.
            if (
                this.closed ||
                !this.sessions.isCurrent(session) ||
                !this.ownershipSessions.isActive(session) ||
                !session.ready ||
                session.socket.readyState !== WebSocket.OPEN
            ) {
                return;
            }

            session.socket.send(message);
        } catch (error: unknown) {
            // An old session must not close a replacement connection.
            if (
                this.closed ||
                !this.sessions.isCurrent(session) ||
                !this.ownershipSessions.isActive(session)
            ) {
                return;
            }

            console.error('Failed to prepare ownership snapshot', {
                nodeId: session.nodeId,
                error,
            });

            // Never substitute a database failure with empty rights.
            if (session.socket.readyState === WebSocket.OPEN) {
                session.socket.close(1011, 'Ownership unavailable');
            }
        } finally {
            session.ownershipRefreshPending = false;
        }
    }

    /**
     * Marks uncertain command outcomes without retrying them.
     *
     * The database transition is conditional: COMPLETED and FAILED
     * cannot be overwritten by UNKNOWN.
     *
     * A failed database write must be reconciled later by a
     * database-backed recovery worker.
     */
    private retireCommands(
        commands: PendingAgentCommand[],
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

    /**
     * Removes all in-memory commands from a disconnected session.
     *
     * Losing a WebSocket connection is not evidence that the
     * Agent stopped or failed the operation.
     */
    private retireSessionCommands(sessionId: string): void {
        const removed =
            this.pendingCommands.drainSession(sessionId);

        this.retireCommands(removed);
    }

    // Public temporarily for deterministic transport tests.
    // Later this can move into a dedicated session monitor.
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

    /**
     * Legacy in-memory transport method.
     *
     * It remains available for existing transport tests, but is
     * disabled when durable command tracking is configured.
     *
     * Do not use this method for real INSTALL dispatching.
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
            this.closed
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
            // Agent acceptance is persisted by processMessage().
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

    isNodeConnected(nodeId: string): boolean {
        if (this.closed) {
            return false;
        }

        const session = this.sessions.get(nodeId);

        return (
            session !== undefined &&
            session.ready &&
            session.socket.readyState === WebSocket.OPEN &&
            Date.now() - session.lastHeartbeat <= HEARTBEAT_TIMEOUT_MS
        );
    }

    disconnectNode(nodeId: string): void {
        const session = this.sessions.get(nodeId);

        if (session) {
            this.ownershipSessions.revoke(session);
            this.retireSessionCommands(session.sessionId);
            session.socket.terminate();
            this.sessions.deleteIfCurrent(session);
        }
    }

    close(): void {
        if (this.closed) {
            return;
        }

        this.closed = true;

        clearInterval(this.heartbeatTimer);
        clearInterval(this.ownershipRefreshTimer);

        this.httpServer.off('upgrade', this.onUpgrade);

        this.httpServer.on(
            'upgrade',
            this.onUpgradeAfterClose,
        );

        for (const socket of this.pendingSockets) {
            socket.destroy();
        }

        this.pendingSockets.clear();

        for (const session of this.sessions.values()) {
            clearTimeout(session.helloTimer);

            this.ownershipSessions.revoke(session);
            this.retireSessionCommands(session.sessionId);

            session.socket.terminate();
        }

        this.sessions.clear();
        this.pendingCommands.clear();

        this.wss.close();
    }
}

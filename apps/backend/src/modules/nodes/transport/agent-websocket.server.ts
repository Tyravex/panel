import { randomUUID } from 'node:crypto';
import { IncomingMessage, Server as HttpServer } from 'node:http';
import { Socket } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';

import { NodesService } from '../nodes.service';
import { isAgentToPanelMessage } from '../protocol/agent-direction';
import {
    AgentCommandPayload,
    createAgentEnvelope,
} from '../protocol/agent-protocol';
import { isValidAgentPayload } from '../protocol/agent-payload';
import { AgentCommandsService } from './agent-commands.service';
import {
    AgentPendingCommands,
    PendingAgentCommand,
} from './agent-pending-commands';

const WS_PATH = '/agent/v1/ws';

const MAX_MESSAGE_BYTES = 16 * 1024;
const MAX_PENDING_AUTH = 64;

const AUTH_TIMEOUT_MS = 10_000;
const HELLO_TIMEOUT_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 90_000;
const COMMAND_RESPONSE_TIMEOUT_MS = 120_000;
const PING_INTERVAL_MS = 30_000;

type Session = {
    sessionId: string;
    nodeId: string;
    token: string;
    socket: WebSocket;
    ready: boolean;
    processing: boolean;
    lastHeartbeat: number;
    awaitingPong: boolean;
    helloTimer: NodeJS.Timeout;
};

export class AgentWebSocketServer {
    private readonly wss = new WebSocketServer({
        noServer: true,
        maxPayload: MAX_MESSAGE_BYTES,
        perMessageDeflate: false,
    });

    private readonly sessions = new Map<string, Session>();
    private readonly pendingCommands = new AgentPendingCommands();
    private readonly pendingSockets = new Set<Socket>();

    private readonly heartbeatTimer: NodeJS.Timeout;
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

        void this.authenticateAndUpgrade(
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

    private async authenticateAndUpgrade(
        request: IncomingMessage,
        socket: Socket,
        head: Buffer,
    ): Promise<void> {
        let authTimer: NodeJS.Timeout | undefined;
        let onSocketClose: (() => void) | undefined;

        const onSocketError = () => undefined;
        socket.on('error', onSocketError);

        try {
            const nodeId = request.headers['x-node-id'];
            const authorization = request.headers.authorization;

            if (
                typeof nodeId !== 'string' ||
                nodeId.length === 0 ||
                nodeId.length > 128 ||
                typeof authorization !== 'string' ||
                !/^Bearer [^\s]+$/.test(authorization)
            ) {
                this.reject(socket, 401, 'Unauthorized');
                return;
            }

            const token = authorization.slice(7);

            const disconnected = new Promise<null>((resolve) => {
                onSocketClose = () => resolve(null);
                socket.once('close', onSocketClose);

                if (socket.destroyed) {
                    resolve(null);
                }
            });

            const timedOut = new Promise<null>((resolve) => {
                authTimer = setTimeout(() => {
                    socket.destroy();
                    resolve(null);
                }, AUTH_TIMEOUT_MS);

                authTimer.unref();
            });

            const authenticated = await Promise.race([
                this.nodesService.authenticateNode(nodeId, token),
                disconnected,
                timedOut,
            ]);

            if (
                !authenticated ||
                this.closed ||
                socket.destroyed ||
                !socket.writable
            ) {
                if (!socket.destroyed) {
                    this.reject(socket, 401, 'Unauthorized');
                }

                return;
            }

            this.wss.handleUpgrade(
                request,
                socket,
                head,
                (ws) => {
                    this.acceptConnection(
                        authenticated.id,
                        token,
                        ws,
                    );
                },
            );
        } finally {
            if (authTimer) {
                clearTimeout(authTimer);
            }

            if (onSocketClose) {
                socket.off('close', onSocketClose);
            }

            socket.off('error', onSocketError);
            this.pendingSockets.delete(socket);
        }
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
            helloTimer: setTimeout(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.close(1008, 'Hello timeout');
                }
            }, HELLO_TIMEOUT_MS),
        };

        session.helloTimer.unref();

        this.sessions.set(nodeId, session);

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

            void this.processMessage(
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

            this.retireSessionCommands(session.sessionId);

            if (this.sessions.get(nodeId) === session) {
                this.sessions.delete(nodeId);
            }
        });

        socket.on('error', () => {
            socket.terminate();
        });
    }

    private async processMessage(
        session: Session,
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

            session.ready = true;
            clearTimeout(session.helloTimer);

            this.send(
                socket,
                'node.welcome',
                {
                    nodeId: session.nodeId,
                    heartbeatIntervalSeconds: 30,
                },
            );

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
                this.sessions.get(session.nodeId) !== session
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
                this.sessions.get(session.nodeId) !== session ||
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
                    this.sessions.get(session.nodeId) !== session ||
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
            this.retireSessionCommands(session.sessionId);
            session.socket.terminate();
            this.sessions.delete(nodeId);
        }
    }

    close(): void {
        if (this.closed) {
            return;
        }

        this.closed = true;

        clearInterval(this.heartbeatTimer);

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

            this.retireSessionCommands(session.sessionId);

            session.socket.terminate();
        }

        this.sessions.clear();
        this.pendingCommands.clear();

        this.wss.close();
    }
}

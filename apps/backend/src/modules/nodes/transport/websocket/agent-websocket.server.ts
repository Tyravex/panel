import { randomUUID } from 'node:crypto';
import { IncomingMessage, Server as HttpServer } from 'node:http';
import { Socket } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';

import { NodesService } from '../../nodes.service';
import { AgentCommandPayload } from '../../protocol/agent-protocol';
import { AgentCommandDispatcher } from '../commands/agent-command-dispatcher';
import { AgentCommandRetirement } from '../commands/agent-command-retirement';
import { AgentCommandsService } from '../commands/agent-commands.service';
import { AgentPendingCommands } from '../commands/agent-pending-commands';
import { AgentWebSocketSessionMonitor } from '../monitoring/agent-websocket-session-monitor';
import { OwnershipSnapshotBuilder } from '../ownership/ownership-snapshot.builder';
import { OwnershipSessionController } from '../ownership/ownership-session.controller';
import { OwnershipSnapshotSender } from '../ownership/ownership-snapshot-sender';
import { AgentSessionRegistry } from '../sessions/agent-session-registry';
import type { AgentSession } from '../sessions/agent-session.types';
import { AgentWebSocketAuth } from './agent-websocket-auth';
import {
    WS_PATH,
    MAX_MESSAGE_BYTES,
    MAX_PENDING_AUTH,
    HELLO_TIMEOUT_MS,
    HEARTBEAT_TIMEOUT_MS,
    PING_INTERVAL_MS,
    OWNERSHIP_REFRESH_INTERVAL_MS,
} from './agent-websocket.constants';
import { AgentWebSocketMessageHandler } from './agent-websocket-message-handler';

type Session = AgentSession;

export class AgentWebSocketServer {
    private readonly wss = new WebSocketServer({
        noServer: true,
        maxPayload: MAX_MESSAGE_BYTES,
        perMessageDeflate: false,
    });

    private readonly messageHandler: AgentWebSocketMessageHandler;
    private readonly commandDispatcher: AgentCommandDispatcher;
    private readonly commandRetirement: AgentCommandRetirement;
    private readonly sessionMonitor: AgentWebSocketSessionMonitor;
    private readonly auth: AgentWebSocketAuth;

    private readonly sessions = new AgentSessionRegistry();
    private readonly pendingCommands = new AgentPendingCommands();
    private readonly pendingSockets = new Set<Socket>();

    private readonly ownershipSessions: OwnershipSessionController;
    private readonly ownershipSnapshotSender: OwnershipSnapshotSender;

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

        this.ownershipSnapshotSender = new OwnershipSnapshotSender(
            this.sessions,
            this.ownershipSessions,
            () => this.closed,
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
            (session) =>
                this.ownershipSnapshotSender.sendInitialOwnershipSnapshot(session),
        );

        this.commandDispatcher = new AgentCommandDispatcher(
            this.sessions,
            this.pendingCommands,
            this.agentCommandsService,
            (nodeId) => this.isNodeConnected(nodeId),
            () => this.closed,
        );

        this.commandRetirement = new AgentCommandRetirement(
            this.pendingCommands,
            this.agentCommandsService,
        );

        this.sessionMonitor = new AgentWebSocketSessionMonitor(
            this.sessions,
            this.pendingCommands,
            this.commandRetirement,
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
            this.commandRetirement.retireSessionCommands(
                previous.sessionId,
            );
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
            this.commandRetirement.retireSessionCommands(
                session.sessionId,
            );

            this.sessions.deleteIfCurrent(session);
        });

        socket.on('error', () => {
            socket.terminate();
        });
    }

    // Public temporarily for deterministic ownership refresh tests.
    refreshOwnershipSnapshots(): void {
        this.ownershipSnapshotSender.refreshOwnershipSnapshots();
    }

    // Public temporarily for deterministic transport tests.
    // Delegates session checks to AgentWebSocketSessionMonitor.
    checkSessions(): void {
        this.sessionMonitor.checkSessions();
    }

    /**
     * Legacy in-memory transport method.
     * Disabled when durable command tracking is configured.
     */
    sendCommand(
        nodeId: string,
        command: AgentCommandPayload,
    ): boolean {
        return this.commandDispatcher.sendCommand(
            nodeId,
            command,
        );
    }

    /**
     * Sends a command whose identity already exists in PostgreSQL.
     * The durable claim is committed before socket.send().
     */
    async sendDurableCommand(
        nodeId: string,
        command: AgentCommandPayload,
    ): Promise<boolean> {
        return this.commandDispatcher.sendDurableCommand(
            nodeId,
            command,
        );
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
            this.commandRetirement.retireSessionCommands(
                session.sessionId,
            );
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
            this.commandRetirement.retireSessionCommands(
                session.sessionId,
            );

            session.socket.terminate();
        }

        this.sessions.clear();
        this.pendingCommands.clear();

        this.wss.close();
    }
}
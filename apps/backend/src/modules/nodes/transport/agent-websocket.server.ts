
import { randomUUID } from 'node:crypto';
import { IncomingMessage, Server as HttpServer } from 'node:http';
import { Socket } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';

import { NodesService } from '../nodes.service';
import { isAgentToPanelMessage } from '../protocol/agent-direction';
import { createAgentEnvelope } from '../protocol/agent-protocol';

const WS_PATH = '/agent/v1/ws';

const MAX_MESSAGE_BYTES = 16 * 1024;
const MAX_PENDING_AUTH = 64;

const AUTH_TIMEOUT_MS = 10_000;
const HELLO_TIMEOUT_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 90_000;
const PING_INTERVAL_MS = 30_000;

type Session = {
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
            previous.socket.terminate();
        }

        const session: Session = {
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

    // Public temporarily for deterministic transport tests.
    // Later this can move into a dedicated session monitor.
    checkSessions(): void {
        const now = Date.now();

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

    disconnectNode(nodeId: string): void {
        const session = this.sessions.get(nodeId);

        if (session) {
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
            session.socket.terminate();
        }

        this.sessions.clear();

        this.wss.close();
    }
}

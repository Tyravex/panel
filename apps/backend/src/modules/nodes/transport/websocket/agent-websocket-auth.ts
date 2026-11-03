import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import type { WebSocket, WebSocketServer } from 'ws';

import { NodesService } from '../../nodes.service';
import { AUTH_TIMEOUT_MS } from './agent-websocket.constants';

type RejectConnection = (
    socket: Socket,
    status: number,
    reason: string,
) => void;

type AcceptConnection = (
    nodeId: string,
    token: string,
    socket: WebSocket,
) => void;

export class AgentWebSocketAuth {
    constructor(
        private readonly nodesService: NodesService,
        private readonly wss: WebSocketServer,
        private readonly pendingSockets: Set<Socket>,
        private readonly isClosed: () => boolean,
        private readonly reject: RejectConnection,
        private readonly acceptConnection: AcceptConnection,
    ) { }

    async authenticateAndUpgrade(
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
                this.isClosed() ||
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
}
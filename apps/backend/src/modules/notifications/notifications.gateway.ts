import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

import { PrismaService } from '@/prisma/prisma.service';

@WebSocketGateway({
    cors: {
        origin: 'http://localhost:5173',
        credentials: true,
    },
})
export class NotificationsGateway
    implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server?: Server;

    private readonly users = new Map<number, Set<string>>();
    private readonly socketSessions = new Map<string, string>();

    constructor(private readonly prisma: PrismaService) { }

    async handleConnection(client: Socket): Promise<void> {
        try {
            const auth = this.getAuth(client);

            if (!auth) {
                client.disconnect(true);
                return;
            }

            const { userId, sessionId } = auth;

            const session = await this.prisma.session.findUnique({
                where: { id: sessionId },
            });

            if (
                !session ||
                session.userId !== userId ||
                session.revokedAt !== null ||
                session.expiresAt <= new Date() ||
                !client.connected
            ) {
                client.disconnect(true);
                return;
            }

            // Reject tokens belonging to deleted users.
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true },
            });

            if (!user || !client.connected) {
                client.disconnect(true);
                return;
            }

            let sockets = this.users.get(userId);

            if (!sockets) {
                sockets = new Set<string>();
                this.users.set(userId, sockets);
            }

            sockets.add(client.id);
            this.socketSessions.set(client.id, sessionId);
        } catch {
            // Never register a socket when authentication fails.
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket): void {
        this.socketSessions.delete(client.id);

        for (const [userId, sockets] of this.users.entries()) {
            sockets.delete(client.id);

            if (sockets.size === 0) {
                this.users.delete(userId);
            }
        }
    }

    async sendToUser(userId: number, payload: unknown): Promise<void> {
        const sockets = this.users.get(userId);

        if (!sockets || !this.server) {
            return;
        }

        for (const socketId of [...sockets]) {
            const socket = this.server.sockets.sockets.get(socketId);
            const sessionId = this.socketSessions.get(socketId);

            if (!socket || !socket.connected || !sessionId) {
                if (socket) {
                    socket.disconnect(true);
                }

                this.socketSessions.delete(socketId);
                sockets.delete(socketId);
                continue;
            }

            try {
                const session = await this.prisma.session.findUnique({
                    where: { id: sessionId },
                });

                if (
                    !session ||
                    session.userId !== userId ||
                    session.revokedAt !== null ||
                    session.expiresAt <= new Date()
                ) {
                    socket.disconnect(true);
                    this.socketSessions.delete(socketId);
                    sockets.delete(socketId);
                    continue;
                }

                // Recheck the connection after the database query.
                if (socket.connected) {
                    socket.emit('notification', payload);
                }
            } catch {
                // Fail closed if session validation is unavailable.
                socket.disconnect(true);
                this.socketSessions.delete(socketId);
                sockets.delete(socketId);
            }
        }

        if (sockets.size === 0) {
            this.users.delete(userId);
        }
    }

    disconnectSession(sessionId: string): void {
        if (!this.server) {
            return;
        }

        for (const [socketId, activeSessionId] of this.socketSessions.entries()) {
            if (activeSessionId !== sessionId) {
                continue;
            }

            const socket = this.server.sockets.sockets.get(socketId);

            // Remove the socket from internal tracking before disconnecting it.
            this.socketSessions.delete(socketId);

            for (const [userId, sockets] of this.users.entries()) {
                sockets.delete(socketId);

                if (sockets.size === 0) {
                    this.users.delete(userId);
                }
            }

            if (socket) {
                socket.disconnect(true);
            }
        }
    }

    private getAuth(
        client: Socket,
    ): { userId: number; sessionId: string } | null {
        const secret = process.env.JWT_SECRET;
        const cookieHeader = client.handshake.headers.cookie;

        if (!secret || !cookieHeader) {
            return null;
        }

        const token = cookieHeader
            .split(';')
            .map((cookie) => cookie.trim())
            .find((cookie) => cookie.startsWith('access_token='))
            ?.slice('access_token='.length);

        if (!token) {
            return null;
        }

        try {
            const decoded = jwt.verify(token, secret, {
                algorithms: ['HS256'],
            });

            if (typeof decoded === 'string') {
                return null;
            }

            if (decoded.tokenType !== 'access') {
                return null;
            }

            const userId: unknown = decoded.sub;
            const sessionId: unknown = decoded.sid;

            if (
                typeof userId !== 'number' ||
                !Number.isSafeInteger(userId) ||
                userId <= 0 ||
                typeof sessionId !== 'string' ||
                sessionId.length === 0
            ) {
                return null;
            }

            return { userId, sessionId };
        } catch {
            return null;
        }
    }
}

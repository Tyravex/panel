import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

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

    private users = new Map<number, Set<string>>();

    handleConnection(client: Socket) {
        //console.log("🔌 CONNECT:", client.id);

        const userId = this.getUserId(client);
        //console.log("👤 USER ID:", userId);

        if (!userId) return;

        if (!this.users.has(userId)) {
            this.users.set(userId, new Set());
        }

        this.users.get(userId)!.add(client.id);

        //console.log("📦 USER SOCKETS:", this.users.get(userId));
    }

    handleDisconnect(client: Socket) {
        for (const [userId, sockets] of this.users.entries()) {
            if (sockets.has(client.id)) {
                sockets.delete(client.id);

                if (sockets.size === 0) {
                    this.users.delete(userId);
                }

                //console.log("❌ DISCONNECT:", client.id);
            }
        }
    }

    sendToUser(userId: number, payload: any) {
        //console.log("📤 SEND TO USER ID:", userId);
        const sockets = this.users.get(userId);
        //console.log("🎯 SOCKETS:", sockets);

        if (!sockets || !this.server) return;

        for (const socketId of sockets) {
            const socket = this.server.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('notification', payload);
                //console.log("✅ Emitted to socket:", socket.id);
            } else {
                //console.log("❌ Socket not found:", socketId);
            }
        }
    }

    private getUserId(client: Socket): number | null {
        try {
            const cookie = client.handshake.headers.cookie;

            if (!cookie) return null;

            const token = cookie
                .split(';')
                .find(c => c.trim().startsWith('access_token='))
                ?.split('=')[1];
            if (!token || !process.env.JWT_SECRET) return null;

            const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
            return decoded.sub;
        } catch {
            return null;
        }
    }
}
import { sign } from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsGateway } from '../notifications.gateway';

describe('Notifications WebSocket delivery boundaries', () => {
    const secret = 'notifications-delivery-security-test-secret';
    const previousSecret = process.env.JWT_SECRET;
    const sessionFindUnique = jest.fn();
    const userFindUnique = jest.fn();
    let gateway: NotificationsGateway;

    function socket(id: string, userId: number, sessionId: string) {
        const emit = jest.fn();
        const disconnect = jest.fn();
        const jwt = sign({ sub: userId, sid: sessionId, tokenType: 'access' }, secret);
        const client = {
            id, connected: true, emit, disconnect,
            handshake: { headers: { cookie: `access_token=${jwt}` } },
        } as unknown as Socket;
        return { client, emit, disconnect };
    }

    function session(userId: number, id: string) {
        return { id, userId, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };
    }

    beforeAll(() => { process.env.JWT_SECRET = secret; });
    afterAll(() => {
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
    });

    beforeEach(() => {
        jest.resetAllMocks();
        gateway = new NotificationsGateway({
            session: { findUnique: sessionFindUnique },
            user: { findUnique: userFindUnique },
        } as unknown as PrismaService);
        userFindUnique.mockImplementation(async ({ where }: { where: { id: number } }) => ({ id: where.id }));
        sessionFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
            const userId = where.id === 'session-A' ? 12 : 13;
            return session(userId, where.id);
        });
    });

    it('delivers only to sockets owned by the target user', async () => {
        const a = socket('socket-A', 12, 'session-A');
        const b = socket('socket-B', 13, 'session-B');
        await gateway.handleConnection(a.client);
        await gateway.handleConnection(b.client);
        gateway.server = {
            sockets: { sockets: new Map([[a.client.id, a.client], [b.client.id, b.client]]) },
        } as unknown as typeof gateway.server;
        const payload = { content: 'User 12 only' };
        await gateway.sendToUser(12, payload);
        expect(a.emit).toHaveBeenCalledWith('notification', payload);
        expect(b.emit).not.toHaveBeenCalled();
    });

    it('does not deliver if the session belongs to another user at send time', async () => {
        const a = socket('socket-A', 12, 'session-A');
        await gateway.handleConnection(a.client);
        gateway.server = { sockets: { sockets: new Map([[a.client.id, a.client]]) } } as unknown as typeof gateway.server;
        sessionFindUnique.mockResolvedValueOnce(session(13, 'session-A'));
        await gateway.sendToUser(12, { content: 'Private' });
        expect(a.emit).not.toHaveBeenCalled();
        expect(a.disconnect).toHaveBeenCalledWith(true);
    });

    it('fails closed when the session lookup throws during delivery', async () => {
        const a = socket('socket-A', 12, 'session-A');
        await gateway.handleConnection(a.client);
        gateway.server = { sockets: { sockets: new Map([[a.client.id, a.client]]) } } as unknown as typeof gateway.server;
        sessionFindUnique.mockRejectedValueOnce(new Error('Database unavailable'));
        await gateway.sendToUser(12, { content: 'Private' });
        expect(a.emit).not.toHaveBeenCalled();
        expect(a.disconnect).toHaveBeenCalledWith(true);
    });

    it('does not deliver to a disconnected socket', async () => {
        const a = socket('socket-A', 12, 'session-A');
        await gateway.handleConnection(a.client);
        Object.defineProperty(a.client, 'connected', { value: false, configurable: true });
        gateway.server = { sockets: { sockets: new Map([[a.client.id, a.client]]) } } as unknown as typeof gateway.server;
        await gateway.sendToUser(12, { content: 'Private' });
        expect(a.emit).not.toHaveBeenCalled();
        expect(a.disconnect).toHaveBeenCalledWith(true);
    });

    it('removes socket delivery tracking after disconnect', async () => {
        const a = socket('socket-A', 12, 'session-A');
        await gateway.handleConnection(a.client);
        gateway.handleDisconnect(a.client);
        gateway.server = { sockets: { sockets: new Map([[a.client.id, a.client]]) } } as unknown as typeof gateway.server;
        sessionFindUnique.mockClear();
        await gateway.sendToUser(12, { content: 'Private' });
        expect(a.emit).not.toHaveBeenCalled();
        expect(sessionFindUnique).not.toHaveBeenCalled();
    });
});

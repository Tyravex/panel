
import { sign } from 'jsonwebtoken';
import { Socket } from 'socket.io';

import { NotificationsGateway } from './notifications.gateway';
import { PrismaService } from '@/prisma/prisma.service';

describe('NotificationsGateway security', () => {
    const findUnique = jest.fn();
    const sessionFindUnique = jest.fn();

    const prisma = {
        user: { findUnique },
        session: { findUnique: sessionFindUnique },
    } as unknown as PrismaService;

    let gateway: NotificationsGateway;
    const originalJwtSecret = process.env.JWT_SECRET;

    const secret = 'tyravex-websocket-security-test-only';

    function createClient(cookie?: string) {
        const disconnect = jest.fn();

        const client = {
            id: 'test-socket',
            connected: true,
            handshake: {
                headers: cookie ? { cookie } : {},
            },
            disconnect,
        } as unknown as Socket;

        return { client, disconnect };
    }

    beforeAll(() => {
        process.env.JWT_SECRET = secret;
    });

    afterAll(() => {
        if (originalJwtSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = originalJwtSecret;
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
        gateway = new NotificationsGateway(prisma);
    });

    it('rejects a connection without a token', async () => {
        const { client, disconnect } = createClient();

        await gateway.handleConnection(client);

        expect(disconnect).toHaveBeenCalledWith(true);
        expect(findUnique).not.toHaveBeenCalled();
    });

    it('rejects an invalid token', async () => {
        const { client, disconnect } = createClient(
            'access_token=invalid-token',
        );

        await gateway.handleConnection(client);

        expect(disconnect).toHaveBeenCalledWith(true);
        expect(findUnique).not.toHaveBeenCalled();
    });

    it('rejects a token with an invalid user ID', async () => {
        const token = sign({ sub: 'invalid' }, secret);
        const { client, disconnect } = createClient(
            `access_token=${token}`,
        );

        await gateway.handleConnection(client);

        expect(disconnect).toHaveBeenCalledWith(true);
        expect(findUnique).not.toHaveBeenCalled();
    });

    it('rejects a token for a deleted user', async () => {
        const token = sign({ sub: 2, sid: 'session-123', tokenType: 'access' }, secret);
        const { client, disconnect } = createClient(
            `access_token=${token}`,
        );

        sessionFindUnique.mockResolvedValue({
            id: 'session-123',
            userId: 2,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
        });

        findUnique.mockResolvedValue(null);

        await gateway.handleConnection(client);

        expect(sessionFindUnique).toHaveBeenCalledWith({
            where: { id: 'session-123' },
        });

        expect(findUnique).toHaveBeenCalledWith({
            where: { id: 2 },
            select: { id: true },
        });

        expect(disconnect).toHaveBeenCalledWith(true);
    });

    it('accepts a valid token with an active session for an existing user', async () => {
        const token = sign({ sub: 2, sid: 'session-123', tokenType: 'access' }, secret);
        const { client, disconnect } = createClient(
            `access_token=${token}`,
        );

        findUnique.mockResolvedValue({ id: 2 });

        sessionFindUnique.mockResolvedValue({
            id: 'session-123',
            userId: 2,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
        });

        await gateway.handleConnection(client);

        expect(findUnique).toHaveBeenCalledWith({
            where: { id: 2 },
            select: { id: true },
        });
        expect(sessionFindUnique).toHaveBeenCalledWith({
            where: { id: 'session-123' },
        });
        expect(disconnect).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
        const token = sign({ sub: 2 }, secret, {
            expiresIn: -1,
        });
        const { client, disconnect } = createClient(
            `access_token=${token}`,
        );

        await gateway.handleConnection(client);

        expect(disconnect).toHaveBeenCalledWith(true);
        expect(findUnique).not.toHaveBeenCalled();
    });
    it('does not register a socket disconnected during authentication', async () => {
        const token = sign({ sub: 2 }, secret);
        const { client, disconnect } = createClient(
            `access_token=${token}`,
        );

        let resolveUser!: (value: { id: number }) => void;

        findUnique.mockReturnValue(
            new Promise<{ id: number }>((resolve) => {
                resolveUser = resolve;
            }),
        );

        const connection = gateway.handleConnection(client);

        // Simulate disconnection while the database query is pending.
        Object.defineProperty(client, 'connected', {
            value: false,
            configurable: true,
        });

        resolveUser({ id: 2 });
        await connection;

        expect(disconnect).toHaveBeenCalledWith(true);

        const emit = jest.fn();

        gateway.server = {
            sockets: {
                sockets: new Map([
                    [client.id, { emit }],
                ]),
            },
        } as unknown as typeof gateway.server;

        gateway.sendToUser(2, { content: 'Private notification' });

        expect(emit).not.toHaveBeenCalled();
    });
    it('rejects a token without a session ID', async () => {
        const token = sign({ sub: 2 }, secret);
        const { client, disconnect } = createClient(
            `access_token=${token}`,
        );

        findUnique.mockResolvedValue({ id: 2 });

        await gateway.handleConnection(client);

        expect(disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects a token for a revoked session', async () => {
        const token = sign({ sub: 2, sid: 'session-123', tokenType: 'access' }, secret);
        const { client, disconnect } = createClient(
            `access_token=${token}`,
        );

        findUnique.mockResolvedValue({ id: 2 });

        sessionFindUnique.mockResolvedValue({
            id: 'session-123',
            userId: 2,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: new Date(),
        });

        await gateway.handleConnection(client);

        expect(disconnect).toHaveBeenCalledWith(true);
        expect(sessionFindUnique).toHaveBeenCalledWith({
            where: { id: 'session-123' },
        });
    });

    it('rejects a token for an expired session', async () => {
        const token = sign({ sub: 2, sid: 'session-123', tokenType: 'access' }, secret);
        const { client, disconnect } = createClient(
            `access_token=${token}`,
        );

        findUnique.mockResolvedValue({ id: 2 });

        sessionFindUnique.mockResolvedValue({
            id: 'session-123',
            userId: 2,
            expiresAt: new Date(Date.now() - 60_000),
            revokedAt: null,
        });

        await gateway.handleConnection(client);

        expect(disconnect).toHaveBeenCalledWith(true);
        expect(sessionFindUnique).toHaveBeenCalledWith({
            where: { id: 'session-123' },
        });
    });
    it('rejects a session belonging to another user', async () => {
        const token = sign({ sub: 2, sid: 'session-123', tokenType: 'access' }, secret);
        const { client, disconnect } = createClient(
            `access_token=${token}`,
        );

        findUnique.mockResolvedValue({ id: 2 });

        sessionFindUnique.mockResolvedValue({
            id: 'session-123',
            userId: 3,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
        });

        await gateway.handleConnection(client);

        expect(sessionFindUnique).toHaveBeenCalledWith({
            where: { id: 'session-123' },
        });
        expect(disconnect).toHaveBeenCalledWith(true);
    });
    it('does not send notifications to a socket with a revoked session', async () => {
        const token = sign({ sub: 2, sid: 'session-123', tokenType: 'access' }, secret);
        const { client, disconnect } = createClient(
            `access_token=${token}`,
        );

        sessionFindUnique.mockResolvedValueOnce({
            id: 'session-123',
            userId: 2,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
        });

        findUnique.mockResolvedValue({ id: 2 });

        await gateway.handleConnection(client);

        expect(disconnect).not.toHaveBeenCalled();

        const emit = jest.fn();

        gateway.server = {
            sockets: {
                sockets: new Map([
                    [client.id, { emit, disconnect }],
                ]),
            },
        } as unknown as typeof gateway.server;

        // The session is revoked after the WebSocket connection was accepted.
        sessionFindUnique.mockResolvedValueOnce({
            id: 'session-123',
            userId: 2,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: new Date(),
        });

        await gateway.sendToUser(2, {
            content: 'Private notification',
        });

        expect(emit).not.toHaveBeenCalled();
        expect(disconnect).toHaveBeenCalledWith(true);
    });
    it('disconnects only sockets belonging to the revoked session', async () => {
        const tokenA = sign({ sub: 2, sid: 'session-A', tokenType: 'access' }, secret);
        const tokenB = sign({ sub: 2, sid: 'session-B', tokenType: 'access' }, secret);

        const first = createClient(`access_token=${tokenA}`);
        const second = createClient(`access_token=${tokenB}`);

        Object.defineProperty(first.client, 'id', {
            value: 'socket-A',
        });

        Object.defineProperty(second.client, 'id', {
            value: 'socket-B',
        });

        sessionFindUnique
            .mockResolvedValueOnce({
                id: 'session-A',
                userId: 2,
                expiresAt: new Date(Date.now() + 60_000),
                revokedAt: null,
            })
            .mockResolvedValueOnce({
                id: 'session-B',
                userId: 2,
                expiresAt: new Date(Date.now() + 60_000),
                revokedAt: null,
            });

        findUnique.mockResolvedValue({ id: 2 });

        await gateway.handleConnection(first.client);
        await gateway.handleConnection(second.client);

        gateway.server = {
            sockets: {
                sockets: new Map([
                    ['socket-A', first.client],
                    ['socket-B', second.client],
                ]),
            },
        } as unknown as typeof gateway.server;

        await gateway.disconnectSession('session-A');

        expect(first.disconnect).toHaveBeenCalledWith(true);
        expect(second.disconnect).not.toHaveBeenCalled();
    });

    it('rejects a refresh token used for WebSocket authentication', async () => {
        const token = sign(
            {
                sub: 2,
                sid: 'session-123',
                tokenType: 'refresh',
            },
            secret,
        );

        const { client, disconnect } = createClient(
            `access_token=${token}`,
        );

        sessionFindUnique.mockResolvedValue({
            id: 'session-123',
            userId: 2,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
        });

        findUnique.mockResolvedValue({ id: 2 });

        await gateway.handleConnection(client);

        expect(disconnect).toHaveBeenCalledWith(true);
        expect(sessionFindUnique).not.toHaveBeenCalled();
        expect(findUnique).not.toHaveBeenCalled();
    });
});

import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import type { WebSocketServer } from 'ws';

import { NodesService } from '../../../nodes.service';
import { AgentWebSocketAuth } from '../agent-websocket-auth';

describe('AgentWebSocketAuth', () => {
    const createDeferred = <T>() => {
        let resolve!: (value: T) => void;

        const promise = new Promise<T>((done) => {
            resolve = done;
        });

        return { promise, resolve };
    };

    const createHarness = () => {
        const socket = Object.assign(new EventEmitter(), {
            destroyed: false,
            writable: true,
            destroy: jest.fn(function (this: EventEmitter & {
                destroyed: boolean;
                writable: boolean;
            }) {
                this.destroyed = true;
                this.writable = false;
                this.emit('close');
            }),
        });

        const authenticateNode = jest.fn();
        const handleUpgrade = jest.fn();
        const reject = jest.fn();
        const acceptConnection = jest.fn();
        const pendingSockets = new Set<Socket>([
            socket as unknown as Socket,
        ]);

        let closed = false;

        const auth = new AgentWebSocketAuth(
            { authenticateNode } as unknown as NodesService,
            { handleUpgrade } as unknown as WebSocketServer,
            pendingSockets,
            () => closed,
            reject,
            acceptConnection,
        );

        const request = {
            headers: {
                'x-node-id': 'node-1',
                authorization: 'Bearer valid-token',
            },
        } as unknown as IncomingMessage;

        return {
            auth,
            socket,
            request,
            authenticateNode,
            handleUpgrade,
            reject,
            acceptConnection,
            pendingSockets,
            setClosed: (value: boolean) => {
                closed = value;
            },
        };
    };

    it('rejects missing node ID without authenticating', async () => {
        const h = createHarness();

        delete h.request.headers['x-node-id'];

        await h.auth.authenticateAndUpgrade(
            h.request,
            h.socket as unknown as Socket,
            Buffer.alloc(0),
        );

        expect(h.reject).toHaveBeenCalledWith(
            h.socket,
            401,
            'Unauthorized',
        );
        expect(h.authenticateNode).not.toHaveBeenCalled();
        expect(h.handleUpgrade).not.toHaveBeenCalled();
        expect(h.pendingSockets.size).toBe(0);
    });

    it('rejects malformed bearer authorization', async () => {
        const h = createHarness();

        h.request.headers.authorization = 'Basic abc';

        await h.auth.authenticateAndUpgrade(
            h.request,
            h.socket as unknown as Socket,
            Buffer.alloc(0),
        );

        expect(h.reject).toHaveBeenCalledWith(
            h.socket,
            401,
            'Unauthorized',
        );
        expect(h.authenticateNode).not.toHaveBeenCalled();
        expect(h.pendingSockets.size).toBe(0);
    });

    it('rejects failed authentication', async () => {
        const h = createHarness();
        h.authenticateNode.mockResolvedValue(null);

        await h.auth.authenticateAndUpgrade(
            h.request,
            h.socket as unknown as Socket,
            Buffer.alloc(0),
        );

        expect(h.authenticateNode).toHaveBeenCalledWith(
            'node-1',
            'valid-token',
        );
        expect(h.reject).toHaveBeenCalledWith(
            h.socket,
            401,
            'Unauthorized',
        );
        expect(h.handleUpgrade).not.toHaveBeenCalled();
        expect(h.pendingSockets.size).toBe(0);
    });

    it('upgrades an authenticated connection', async () => {
        const h = createHarness();
        const ws = {} as Parameters<
            Parameters<WebSocketServer['handleUpgrade']>[3]
        >[0];

        h.authenticateNode.mockResolvedValue({
            id: 'authenticated-node',
        });

        h.handleUpgrade.mockImplementation(
            (
                _request: unknown,
                _socket: unknown,
                _head: unknown,
                callback: (socket: typeof ws) => void,
            ) => callback(ws),
        );

        await h.auth.authenticateAndUpgrade(
            h.request,
            h.socket as unknown as Socket,
            Buffer.alloc(0),
        );

        expect(h.acceptConnection).toHaveBeenCalledWith(
            'authenticated-node',
            'valid-token',
            ws,
        );
        expect(h.reject).not.toHaveBeenCalled();
        expect(h.pendingSockets.size).toBe(0);
    });

    it('does not upgrade after the server closes', async () => {
        const h = createHarness();
        const deferred = createDeferred<{ id: string }>();

        h.authenticateNode.mockReturnValue(deferred.promise);

        const pending = h.auth.authenticateAndUpgrade(
            h.request,
            h.socket as unknown as Socket,
            Buffer.alloc(0),
        );

        h.setClosed(true);
        deferred.resolve({ id: 'node-1' });

        await pending;

        expect(h.handleUpgrade).not.toHaveBeenCalled();
        expect(h.reject).toHaveBeenCalledWith(
            h.socket,
            401,
            'Unauthorized',
        );
        expect(h.pendingSockets.size).toBe(0);
    });

    it('does not upgrade after the socket disconnects', async () => {
        const h = createHarness();
        const deferred = createDeferred<{ id: string }>();

        h.authenticateNode.mockReturnValue(deferred.promise);

        const pending = h.auth.authenticateAndUpgrade(
            h.request,
            h.socket as unknown as Socket,
            Buffer.alloc(0),
        );

        h.socket.destroy();
        await pending;

        deferred.resolve({ id: 'node-1' });
        await Promise.resolve();

        expect(h.handleUpgrade).not.toHaveBeenCalled();
        expect(h.pendingSockets.size).toBe(0);
    });

    it('destroys a socket when authentication times out', async () => {
        jest.useFakeTimers();

        try {
            const h = createHarness();

            h.authenticateNode.mockReturnValue(
                new Promise(() => undefined),
            );

            const pending = h.auth.authenticateAndUpgrade(
                h.request,
                h.socket as unknown as Socket,
                Buffer.alloc(0),
            );

            await jest.advanceTimersByTimeAsync(10_000);
            await pending;

            expect(h.socket.destroy).toHaveBeenCalledTimes(1);
            expect(h.handleUpgrade).not.toHaveBeenCalled();
            expect(h.pendingSockets.size).toBe(0);
        } finally {
            jest.useRealTimers();
        }
    });

    it('cleans up pending state when authentication throws', async () => {
        const h = createHarness();

        h.authenticateNode.mockRejectedValue(
            new Error('Authentication failed'),
        );

        await expect(
            h.auth.authenticateAndUpgrade(
                h.request,
                h.socket as unknown as Socket,
                Buffer.alloc(0),
            ),
        ).rejects.toThrow('Authentication failed');

        expect(h.handleUpgrade).not.toHaveBeenCalled();
        expect(h.pendingSockets.size).toBe(0);
    });
});
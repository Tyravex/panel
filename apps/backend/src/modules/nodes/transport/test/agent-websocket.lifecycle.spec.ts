import { createServer, Server as HttpServer } from 'node:http';
import { once } from 'node:events';
import { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';

import { NodesService } from '../../nodes.service';
import { AgentCommandsService } from '../agent-commands.service';
import { AgentWebSocketLifecycle } from '../agent-websocket.lifecycle';

describe('AgentWebSocketLifecycle', () => {
    let httpServer: HttpServer;
    let lifecycle: AgentWebSocketLifecycle;
    let url: string;

    const clients: WebSocket[] = [];

    const authenticateNode = jest.fn();
    const heartbeat = jest.fn();

    const findById = jest.fn();
    const claimSend = jest.fn();
    const markAccepted = jest.fn();
    const markResult = jest.fn();
    const markUnknown = jest.fn();

    beforeEach(async () => {
        jest.clearAllMocks();

        authenticateNode.mockResolvedValue({
            id: 'node-1',
            name: 'Test node',
            status: 'OFFLINE',
        });

        heartbeat.mockResolvedValue({
            ok: true,
            lastSeenAt: new Date().toISOString(),
        });

        findById.mockResolvedValue(null);
        claimSend.mockResolvedValue(false);
        markAccepted.mockResolvedValue(false);
        markResult.mockResolvedValue(false);
        markUnknown.mockResolvedValue(false);

        httpServer = createServer();

        lifecycle = new AgentWebSocketLifecycle(
            {
                authenticateNode,
                heartbeat,
            } as unknown as NodesService,
            {
                findById,
                claimSend,
                markAccepted,
                markResult,
                markUnknown,
            } as unknown as AgentCommandsService,
        );

        lifecycle.attach(httpServer);

        httpServer.listen(0, '127.0.0.1');
        await once(httpServer, 'listening');

        const address = httpServer.address() as AddressInfo;

        url = `ws://127.0.0.1:${address.port}/agent/v1/ws`;
    });

    afterEach(async () => {
        for (const client of clients) {
            if (
                client.readyState === WebSocket.OPEN ||
                client.readyState === WebSocket.CLOSING ||
                client.readyState === WebSocket.CONNECTING
            ) {
                client.on('error', () => undefined);
                client.terminate();
            }
        }

        clients.length = 0;

        lifecycle.onApplicationShutdown();

        if (httpServer.listening) {
            await new Promise<void>((resolve, reject) => {
                httpServer.close((error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });

                httpServer.closeAllConnections();
            });
        }
    });

    it('closes active Agent connections on application shutdown', async () => {
        const client = new WebSocket(url, {
            headers: {
                Authorization: 'Bearer valid-node-token',
                'X-Node-ID': 'node-1',
            },
        });

        clients.push(client);

        await once(client, 'open');

        expect(client.readyState).toBe(WebSocket.OPEN);

        const closePromise = once(client, 'close');

        lifecycle.onApplicationShutdown();

        const [closeCode] = await closePromise;

        expect(closeCode).toBe(1006);
        expect(client.readyState).toBe(WebSocket.CLOSED);
    });

    it('does not accept Agent connections after application shutdown', async () => {
        lifecycle.onApplicationShutdown();

        const client = new WebSocket(url, {
            headers: {
                Authorization: 'Bearer valid-node-token',
                'X-Node-ID': 'node-1',
            },
        });

        clients.push(client);

        const statusCode = await new Promise<number>(
            (resolve, reject) => {
                client.once('unexpected-response', (_request, response) => {
                    const status = response.statusCode;

                    response.resume();

                    if (status === undefined) {
                        reject(new Error('Missing HTTP status code'));
                        return;
                    }

                    resolve(status);
                });

                client.once('error', reject);
            },
        );

        expect(statusCode).toBe(503);
    });
});

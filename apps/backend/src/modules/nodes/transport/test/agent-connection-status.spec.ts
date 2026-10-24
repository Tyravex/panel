import { createServer, Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { WebSocket, type RawData } from 'ws';

import { AgentWebSocketServer } from '../agent-websocket.server';
import { NodesService } from '../../nodes.service';
import { createAgentEnvelope } from '../../protocol/agent-protocol';

const NODE_ID = 'connection-test-node';
const TOKEN = 'connection-test-token';

describe('Agent connection status', () => {
    let httpServer: HttpServer;
    let transport: AgentWebSocketServer;
    let clients: WebSocket[];
    let port: number;

    beforeEach(async () => {
        clients = [];

        httpServer = createServer();

        const nodesService = {
            authenticateNode: jest.fn().mockResolvedValue({
                id: NODE_ID,
            }),
            heartbeat: jest.fn().mockResolvedValue({
                ok: true,
            }),
        } as unknown as NodesService;

        transport = new AgentWebSocketServer(
            httpServer,
            nodesService,
        );

        await new Promise<void>((resolve) => {
            httpServer.listen(0, '127.0.0.1', resolve);
        });

        port = (httpServer.address() as AddressInfo).port;
    });

    afterEach(async () => {
        transport.close();

        for (const client of clients) {
            client.terminate();
        }

        await new Promise<void>((resolve, reject) => {
            httpServer.close((error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    });

    function connect(): Promise<WebSocket> {
        return new Promise((resolve, reject) => {
            const client = new WebSocket(
                `ws://127.0.0.1:${port}/agent/v1/ws`,
                {
                    headers: {
                        'x-node-id': NODE_ID,
                        Authorization: `Bearer ${TOKEN}`,
                    },
                },
            );

            clients.push(client);

            client.once('open', () => resolve(client));
            client.once('error', reject);
        });
    }

    function waitForMessage(
        client: WebSocket,
        expectedType: string,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                client.off('message', onMessage);
                reject(
                    new Error(
                        `Timed out waiting for ${expectedType}`,
                    ),
                );
            }, 3000);

            function onMessage(data: RawData): void {
                const message = JSON.parse(
                    data.toString('utf8'),
                ) as { type?: string };

                if (message.type !== expectedType) {
                    return;
                }

                clearTimeout(timeout);
                client.off('message', onMessage);
                resolve();
            }

            client.on('message', onMessage);
        });
    }

    async function completeHello(
        client: WebSocket,
    ): Promise<void> {
        const welcome = waitForMessage(
            client,
            'node.welcome',
        );

        client.send(
            JSON.stringify(
                createAgentEnvelope(
                    'node.hello',
                    {
                        agentVersion: 'test-agent',
                        capabilities: [],
                    },
                    'hello-test-1',
                ),
            ),
        );

        await welcome;
    }

    it('returns false when no Agent is connected', () => {
        expect(transport.isNodeConnected(NODE_ID)).toBe(false);
    });

    it('returns false before node.hello', async () => {
        await connect();

        expect(transport.isNodeConnected(NODE_ID)).toBe(false);
    });

    it('returns true after successful node.hello', async () => {
        const client = await connect();

        await completeHello(client);

        expect(transport.isNodeConnected(NODE_ID)).toBe(true);
        expect(
            transport.isNodeConnected('different-node'),
        ).toBe(false);
    });

    it('returns false after Agent disconnects', async () => {
        const client = await connect();

        await completeHello(client);

        expect(transport.isNodeConnected(NODE_ID)).toBe(true);

        const disconnected = new Promise<void>((resolve) => {
            client.once('close', () => resolve());
        });

        client.close();
        await disconnected;

        expect(transport.isNodeConnected(NODE_ID)).toBe(false);
    });

    it('returns false after transport shutdown', async () => {
        const client = await connect();

        await completeHello(client);

        expect(transport.isNodeConnected(NODE_ID)).toBe(true);

        transport.close();

        expect(transport.isNodeConnected(NODE_ID)).toBe(false);
    });
});

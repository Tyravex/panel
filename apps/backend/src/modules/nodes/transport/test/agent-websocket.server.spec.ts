import { createServer, Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { WebSocket } from 'ws';

import { NodesService } from '../../nodes.service';
import { createAgentEnvelope } from '../../protocol/agent-protocol';
import { AgentWebSocketServer } from '../agent-websocket.server';

describe('Agent WebSocket transport', () => {
    let httpServer: HttpServer;
    let transport: AgentWebSocketServer;
    let url: string;

    const clients: WebSocket[] = [];

    const authenticateNode = jest.fn();
    const heartbeat = jest.fn();

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

        httpServer = createServer();

        transport = new AgentWebSocketServer(
            httpServer,
            {
                authenticateNode,
                heartbeat,
            } as unknown as NodesService,
        );

        httpServer.listen(0, '127.0.0.1');
        await once(httpServer, 'listening');

        const address = httpServer.address() as AddressInfo;

        url = `ws://127.0.0.1:${address.port}/agent/v1/ws`;
    });

    afterEach(async () => {
        for (const client of clients) {
            if (client.readyState === WebSocket.CONNECTING) {
                client.on('error', () => undefined);
                client.terminate();
            } else if (
                client.readyState === WebSocket.OPEN ||
                client.readyState === WebSocket.CLOSING
            ) {
                client.terminate();
            }
        }

        clients.length = 0;

        transport.close();

        await new Promise<void>((resolve, reject) => {
            if (!httpServer.listening) {
                resolve();
                return;
            }

            httpServer.close((error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });

            httpServer.closeAllConnections();
        });
    });

    function connect(
        token = 'valid-node-token',
        nodeId = 'node-1',
        autoPong = true,
    ): WebSocket {
        const client = new WebSocket(url, {
            autoPong,
            headers: {
                Authorization: `Bearer ${token}`,
                'X-Node-ID': nodeId,
            },
        });

        clients.push(client);

        return client;
    }

    async function openClient(
        token = 'valid-node-token',
    ): Promise<WebSocket> {
        const client = connect(token);
        await once(client, 'open');
        return client;
    }

    function hello() {
        return createAgentEnvelope(
            'node.hello',
            {
                agentVersion: '0.4.0',
                capabilities: ['docker'],
            },
            'hello-1',
        );
    }

    function heartbeatMessage() {
        return createAgentEnvelope(
            'node.heartbeat',
            {
                uptimeSeconds: 100,
                docker: {
                    available: true,
                    version: '29.2.1',
                },
            },
            'heartbeat-1',
        );
    }

    async function receiveMessage(
        client: WebSocket,
    ): Promise<Record<string, unknown>> {
        const [data] = await once(client, 'message');

        return JSON.parse(data.toString()) as Record<
            string,
            unknown
        >;
    }

    it('authenticates a valid node', async () => {
        const client = await openClient();

        expect(client.readyState).toBe(WebSocket.OPEN);

        expect(authenticateNode).toHaveBeenCalledWith(
            'node-1',
            'valid-node-token',
        );
    });

    it('rejects invalid credentials', async () => {
        authenticateNode.mockResolvedValue(null);

        const client = connect('invalid-token');

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

        expect(statusCode).toBe(401);
        expect(authenticateNode).toHaveBeenCalledWith(
            'node-1',
            'invalid-token',
        );
    });

    it('responds to node.hello with node.welcome', async () => {
        const client = await openClient();

        const responsePromise = receiveMessage(client);

        client.send(JSON.stringify(hello()));

        const response = await responsePromise;

        expect(response.type).toBe('node.welcome');
        expect(response.protocol).toBe(1);
        expect(response.payload).toEqual({
            nodeId: 'node-1',
            heartbeatIntervalSeconds: 30,
        });
    });

    it('rejects heartbeat before hello', async () => {
        const client = await openClient();

        const closePromise = once(client, 'close');

        client.send(JSON.stringify(heartbeatMessage()));

        const [code] = await closePromise;

        expect(code).toBe(1008);
        expect(heartbeat).not.toHaveBeenCalled();
    });

    it('accepts heartbeat after hello', async () => {
        const client = await openClient();

        const welcomePromise = receiveMessage(client);

        client.send(JSON.stringify(hello()));

        await welcomePromise;

        const ackPromise = receiveMessage(client);

        client.send(JSON.stringify(heartbeatMessage()));

        const response = await ackPromise;

        expect(response.type).toBe('node.heartbeat.ack');

        expect(heartbeat).toHaveBeenCalledWith(
            'node-1',
            'valid-node-token',
        );
    });

    it('rejects commands sent by Agent', async () => {
        const client = await openClient();

        const welcomePromise = receiveMessage(client);

        client.send(JSON.stringify(hello()));

        await welcomePromise;

        const closePromise = once(client, 'close');

        client.send(
            JSON.stringify(
                createAgentEnvelope(
                    'command.execute',
                    {
                        commandId: 'command-1',
                        operation: 'server.start',
                        serverId: 'server-1',
                        parameters: {},
                    },
                    'command-message-1',
                ),
            ),
        );

        const [code] = await closePromise;

        expect(code).toBe(1008);
    });

    it('rejects malformed JSON', async () => {
        const client = await openClient();

        const closePromise = once(client, 'close');

        client.send('{invalid-json');

        const [code] = await closePromise;

        expect(code).toBe(1007);
    });

    it('rejects binary messages', async () => {
        const client = await openClient();

        const closePromise = once(client, 'close');

        client.send(Buffer.from([1, 2, 3]));

        const [code] = await closePromise;

        expect(code).toBe(1003);
    });

    it('rejects invalid hello payload', async () => {
        const client = await openClient();

        const closePromise = once(client, 'close');

        client.send(
            JSON.stringify(
                createAgentEnvelope(
                    'node.hello',
                    {
                        agentVersion: '',
                        capabilities: [],
                    },
                    'hello-invalid',
                ),
            ),
        );

        const [code] = await closePromise;

        expect(code).toBe(1008);
    });

    it('replaces the previous connection for the same node', async () => {
        const first = await openClient();

        const firstClosePromise = once(first, 'close');

        const second = await openClient();

        const [firstCloseCode] = await firstClosePromise;

        expect(firstCloseCode).toBe(1006);
        expect(second.readyState).toBe(WebSocket.OPEN);

        const welcomePromise = receiveMessage(second);

        second.send(JSON.stringify(hello()));

        const welcome = await welcomePromise;

        expect(welcome.type).toBe('node.welcome');

        const ackPromise = receiveMessage(second);

        second.send(JSON.stringify(heartbeatMessage()));

        const ack = await ackPromise;

        expect(ack.type).toBe('node.heartbeat.ack');
        expect(heartbeat).toHaveBeenCalledTimes(1);
    });

    it('disconnects an active node session', async () => {
        const client = await openClient();

        const closePromise = once(client, 'close');

        transport.disconnectNode('node-1');

        const [closeCode] = await closePromise;

        expect(closeCode).toBe(1006);
        expect(client.readyState).toBe(WebSocket.CLOSED);
    });

    it('rejects the connection when authentication throws', async () => {
        authenticateNode.mockRejectedValue(
            new Error('Database unavailable'),
        );

        const client = connect();

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

        expect(statusCode).toBe(401);
    });

    it('does not upgrade a disconnected client after authentication completes', async () => {
        let resolveAuthentication!: (value: {
            id: string;
            name: string;
            status: string;
        }) => void;

        authenticateNode.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveAuthentication = resolve;
                }),
        );

        const client = connect();

        for (let attempt = 0; attempt < 100; attempt++) {
            if (authenticateNode.mock.calls.length > 0) {
                break;
            }

            await new Promise<void>((resolve) => {
                setTimeout(resolve, 5);
            });
        }

        expect(authenticateNode).toHaveBeenCalledTimes(1);

        const closePromise = new Promise<void>((resolve) => {
            client.once('close', () => resolve());
            client.once('error', () => undefined);
        });

        client.terminate();

        await closePromise;

        resolveAuthentication({
            id: 'node-1',
            name: 'Test node',
            status: 'OFFLINE',
        });

        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });

        expect(client.readyState).toBe(WebSocket.CLOSED);
    });

    it('disconnects a client that does not send node.hello in time', async () => {
        jest.useFakeTimers({
            doNotFake: [
                'nextTick',
                'setImmediate',
                'clearImmediate',
            ],
        });

        try {
            const client = await openClient();

            const closePromise = once(client, 'close');

            await jest.advanceTimersByTimeAsync(10_001);

            const [closeCode] = await closePromise;

            expect(closeCode).toBe(1008);
            expect(client.readyState).toBe(WebSocket.CLOSED);
            expect(heartbeat).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

    it('terminates a client that does not respond to ping', async () => {
        const client = connect(
            'valid-node-token',
            'node-1',
            false,
        );

        await once(client, 'open');

        const welcomePromise = receiveMessage(client);

        client.send(JSON.stringify(hello()));

        await welcomePromise;

        const pingPromise = once(client, 'ping');

        // First check sends a ping frame.
        transport.checkSessions();

        await pingPromise;

        expect(client.readyState).toBe(WebSocket.OPEN);

        const closePromise = once(client, 'close');

        // Second check terminates the session without pong.
        transport.checkSessions();

        const [closeCode] = await closePromise;

        expect(closeCode).toBe(1006);
        expect(client.readyState).toBe(WebSocket.CLOSED);
    });

    it('closes active connections during transport shutdown', async () => {
        const client = await openClient();

        const closePromise = once(client, 'close');

        transport.close();

        const [closeCode] = await closePromise;

        expect(closeCode).toBe(1006);
        expect(client.readyState).toBe(WebSocket.CLOSED);
    });

    it('rejects new connections after transport shutdown', async () => {
        transport.close();

        const client = connect();

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

    it('removes the shutdown upgrade listener when HTTP server closes', async () => {
        transport.close();

        expect(
            httpServer.listeners('upgrade'),
        ).toContainEqual(expect.any(Function));

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

        expect(httpServer.listenerCount('upgrade')).toBe(0);
    });

    it('disconnects a node when heartbeat authentication is rejected', async () => {
        heartbeat.mockResolvedValue({
            ok: false,
        });

        const client = await openClient();

        const welcomePromise = receiveMessage(client);

        client.send(JSON.stringify(hello()));

        await welcomePromise;

        const closePromise = once(client, 'close');

        client.send(JSON.stringify(heartbeatMessage()));

        const [closeCode] = await closePromise;

        expect(closeCode).toBe(1008);
        expect(heartbeat).toHaveBeenCalledWith(
            'node-1',
            'valid-node-token',
        );
    });

    it('does not acknowledge heartbeat after the node is disconnected', async () => {
        let resolveHeartbeat!: (value: {
            ok: boolean;
            lastSeenAt: string;
        }) => void;

        heartbeat.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveHeartbeat = resolve;
                }),
        );

        const client = await openClient();

        const welcomePromise = receiveMessage(client);

        client.send(JSON.stringify(hello()));

        await welcomePromise;

        const receivedMessages: string[] = [];

        client.on('message', (data) => {
            receivedMessages.push(data.toString());
        });

        client.send(JSON.stringify(heartbeatMessage()));

        // Wait until the heartbeat operation has started.
        for (let attempt = 0; attempt < 100; attempt++) {
            if (heartbeat.mock.calls.length > 0) {
                break;
            }

            await new Promise<void>((resolve) => {
                setTimeout(resolve, 5);
            });
        }

        expect(heartbeat).toHaveBeenCalledTimes(1);

        const closePromise = once(client, 'close');

        // Simulate token rotation disconnecting this session.
        transport.disconnectNode('node-1');

        await closePromise;

        // The database finishes the old heartbeat afterwards.
        resolveHeartbeat({
            ok: true,
            lastSeenAt: new Date().toISOString(),
        });

        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });

        expect(client.readyState).toBe(WebSocket.CLOSED);
        expect(receivedMessages).toHaveLength(0);
    });

});

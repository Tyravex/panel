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
    const findAssignedServiceIds = jest.fn();

    beforeEach(async () => {
        jest.clearAllMocks();
        findAssignedServiceIds.mockReset();

        authenticateNode.mockResolvedValue({
            id: 'node-1',
            name: 'Test node',
            status: 'OFFLINE',
        });

        heartbeat.mockResolvedValue({
            ok: true,
            lastSeenAt: new Date().toISOString(),
        });

        findAssignedServiceIds.mockResolvedValue([]);

        httpServer = createServer();

        transport = new AgentWebSocketServer(
            httpServer,
            {
                authenticateNode,
                heartbeat,
                findAssignedServiceIds,
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

    function captureMessages(client: WebSocket) {
        const messages: Record<string, unknown>[] = [];

        client.on('message', (data) => {
            messages.push(
                JSON.parse(data.toString('utf8')) as Record<
                    string,
                    unknown
                >,
            );
        });

        async function waitForType(
            type: string,
        ): Promise<Record<string, unknown>> {
            for (let attempt = 0; attempt < 100; attempt++) {
                const message = messages.find(
                    (item) => item.type === type,
                );

                if (message) {
                    return message;
                }

                await new Promise<void>((resolve) => {
                    setTimeout(resolve, 5);
                });
            }

            throw new Error(`Timed out waiting for ${type}`);
        }

        return { messages, waitForType };
    }

    async function waitForSnapshotCount(
        capture: ReturnType<typeof captureMessages>,
        expectedCount: number,
    ): Promise<Record<string, unknown>[]> {
        for (let attempt = 0; attempt < 200; attempt++) {
            const snapshots = capture.messages.filter(
                (message) => message.type === 'ownership.snapshot',
            );

            if (snapshots.length >= expectedCount) {
                return snapshots;
            }

            await new Promise<void>((resolve) => {
                setTimeout(resolve, 5);
            });
        }

        throw new Error(
            `Timed out waiting for ${expectedCount} ownership snapshots`,
        );
    }

    function sendHello(client: WebSocket): void {
        client.send(JSON.stringify(hello()));
    }

    function payloadOf(
        message: Record<string, unknown>,
    ): Record<string, unknown> {
        const payload = message.payload;

        if (
            typeof payload !== 'object' ||
            payload === null ||
            Array.isArray(payload)
        ) {
            throw new Error('Invalid message payload');
        }

        return payload as Record<string, unknown>;
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
                client.once(
                    'unexpected-response',
                    (_request, response) => {
                        const status = response.statusCode;

                        response.resume();

                        if (status === undefined) {
                            reject(
                                new Error('Missing HTTP status code'),
                            );
                            return;
                        }

                        resolve(status);
                    },
                );

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

        const payload = payloadOf(response);

        expect(payload).toEqual({
            nodeId: 'node-1',
            heartbeatIntervalSeconds: 30,
            sessionId: expect.any(String),
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

        const capture = captureMessages(client);

        sendHello(client);

        await capture.waitForType('node.welcome');
        await capture.waitForType('ownership.snapshot');

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

        const capture = captureMessages(second);

        sendHello(second);

        const welcome = await capture.waitForType('node.welcome');
        await capture.waitForType('ownership.snapshot');

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
                client.once(
                    'unexpected-response',
                    (_request, response) => {
                        const status = response.statusCode;

                        response.resume();

                        if (status === undefined) {
                            reject(
                                new Error('Missing HTTP status code'),
                            );
                            return;
                        }

                        resolve(status);
                    },
                );

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

        const capture = captureMessages(client);

        sendHello(client);

        await capture.waitForType('node.welcome');
        await capture.waitForType('ownership.snapshot');

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
                client.once(
                    'unexpected-response',
                    (_request, response) => {
                        const status = response.statusCode;

                        response.resume();

                        if (status === undefined) {
                            reject(
                                new Error('Missing HTTP status code'),
                            );
                            return;
                        }

                        resolve(status);
                    },
                );

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

        const capture = captureMessages(client);

        sendHello(client);

        await capture.waitForType('node.welcome');
        await capture.waitForType('ownership.snapshot');

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

    it('sends welcome before ownership snapshot with trusted database assignments', async () => {
        findAssignedServiceIds.mockResolvedValue([
            'service-1',
            'service-2',
        ]);

        const client = await openClient();
        const capture = captureMessages(client);

        sendHello(client);

        const welcome = await capture.waitForType('node.welcome');
        const snapshot = await capture.waitForType('ownership.snapshot');

        const welcomePayload = payloadOf(welcome);
        const snapshotPayload = payloadOf(snapshot);

        expect(capture.messages[0]?.type).toBe('node.welcome');
        expect(capture.messages[1]?.type).toBe('ownership.snapshot');

        expect(typeof welcomePayload.sessionId).toBe('string');
        expect(snapshotPayload).toEqual({
            type: 'ownership.snapshot',
            session_id: welcomePayload.sessionId,
            node_id: 'node-1',
            revision: 1,
            ttl_seconds: 60,
            assignments: [
                {
                    service_id: 'service-1',
                    node_id: 'node-1',
                    enabled: true,
                },
                {
                    service_id: 'service-2',
                    node_id: 'node-1',
                    enabled: true,
                },
            ],
        });

        expect(findAssignedServiceIds).toHaveBeenCalledWith('node-1');
    });

    it('creates a new ownership session with revision one after reconnect', async () => {
        const first = await openClient();
        const firstCapture = captureMessages(first);

        sendHello(first);

        const firstWelcome = await firstCapture.waitForType('node.welcome');
        await firstCapture.waitForType('ownership.snapshot');

        const firstSessionId = payloadOf(firstWelcome).sessionId;

        const firstClosed = once(first, 'close');

        const second = await openClient();
        await firstClosed;

        const secondCapture = captureMessages(second);

        sendHello(second);

        const secondWelcome = await secondCapture.waitForType('node.welcome');
        const secondSnapshot = await secondCapture.waitForType(
            'ownership.snapshot',
        );

        const secondSessionId = payloadOf(secondWelcome).sessionId;
        const snapshotPayload = payloadOf(secondSnapshot);

        expect(secondSessionId).not.toBe(firstSessionId);
        expect(snapshotPayload.session_id).toBe(secondSessionId);
        expect(snapshotPayload.revision).toBe(1);
        expect(transport.isNodeConnected('node-1')).toBe(true);
    });

    it('does not publish a stale ownership snapshot after reconnect', async () => {
        let resolveFirstRead!: (value: string[]) => void;

        const firstRead = new Promise<string[]>((resolve) => {
            resolveFirstRead = resolve;
        });

        findAssignedServiceIds
            .mockImplementationOnce(() => firstRead)
            .mockResolvedValueOnce(['service-current']);

        const first = await openClient();
        const firstCapture = captureMessages(first);

        sendHello(first);

        await firstCapture.waitForType('node.welcome');

        // Ensure the first database read has started.
        expect(findAssignedServiceIds).toHaveBeenCalledTimes(1);

        const firstClosed = once(first, 'close');

        const second = await openClient();
        await firstClosed;

        const secondCapture = captureMessages(second);

        sendHello(second);

        const secondWelcome = await secondCapture.waitForType('node.welcome');
        const secondSnapshot = await secondCapture.waitForType(
            'ownership.snapshot',
        );

        // Complete the old read only after the replacement session is active.
        resolveFirstRead(['service-stale']);

        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });

        const snapshotPayload = payloadOf(secondSnapshot);

        expect(snapshotPayload.session_id).toBe(
            payloadOf(secondWelcome).sessionId,
        );

        expect(snapshotPayload.assignments).toEqual([
            {
                service_id: 'service-current',
                node_id: 'node-1',
                enabled: true,
            },
        ]);

        expect(
            firstCapture.messages.some(
                (message) => message.type === 'ownership.snapshot',
            ),
        ).toBe(false);

        expect(
            secondCapture.messages.filter(
                (message) => message.type === 'ownership.snapshot',
            ),
        ).toHaveLength(1);
    });

    it('closes the connection with 1011 when ownership database read fails', async () => {
        findAssignedServiceIds.mockRejectedValue(
            new Error('Database unavailable'),
        );

        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        try {
            const client = await openClient();
            const capture = captureMessages(client);

            const closePromise = once(client, 'close');

            sendHello(client);

            const welcome = await capture.waitForType('node.welcome');
            const [closeCode] = await closePromise;

            expect(welcome.type).toBe('node.welcome');
            expect(closeCode).toBe(1011);

            expect(
                capture.messages.some(
                    (message) => message.type === 'ownership.snapshot',
                ),
            ).toBe(false);

            expect(transport.isNodeConnected('node-1')).toBe(false);
        } finally {
            errorSpy.mockRestore();
        }
    });

    it('refreshes ownership snapshot with increasing revision', async () => {
        findAssignedServiceIds
            .mockResolvedValueOnce(['service-1'])
            .mockResolvedValueOnce(['service-2']);

        const client = await openClient();
        const capture = captureMessages(client);

        sendHello(client);

        const welcome = await capture.waitForType('node.welcome');
        const [initial] = await waitForSnapshotCount(capture, 1);

        expect(payloadOf(initial).revision).toBe(1);

        transport.refreshOwnershipSnapshots();

        const snapshots = await waitForSnapshotCount(capture, 2);

        expect(payloadOf(snapshots[0]).revision).toBe(1);
        expect(payloadOf(snapshots[1]).revision).toBe(2);
        expect(payloadOf(snapshots[1]).session_id).toBe(
            payloadOf(welcome).sessionId,
        );
        expect(payloadOf(snapshots[1]).assignments).toEqual([
            {
                service_id: 'service-2',
                node_id: 'node-1',
                enabled: true,
            },
        ]);
        expect(findAssignedServiceIds).toHaveBeenCalledTimes(2);
    });

    it('does not overlap ownership database reads during refresh', async () => {
        let resolveRefresh!: (value: string[]) => void;

        const pendingRefresh = new Promise<string[]>((resolve) => {
            resolveRefresh = resolve;
        });

        findAssignedServiceIds
            .mockResolvedValueOnce(['service-initial'])
            .mockImplementationOnce(() => pendingRefresh)
            .mockResolvedValue(['service-unexpected']);

        const client = await openClient();
        const capture = captureMessages(client);

        sendHello(client);
        await capture.waitForType('node.welcome');
        await waitForSnapshotCount(capture, 1);

        transport.refreshOwnershipSnapshots();
        expect(findAssignedServiceIds).toHaveBeenCalledTimes(2);

        // A second tick must not start another database query.
        transport.refreshOwnershipSnapshots();
        transport.refreshOwnershipSnapshots();
        expect(findAssignedServiceIds).toHaveBeenCalledTimes(2);

        resolveRefresh(['service-updated']);

        const snapshots = await waitForSnapshotCount(capture, 2);
        expect(payloadOf(snapshots[1]).revision).toBe(2);
        expect(payloadOf(snapshots[1]).assignments).toEqual([
            {
                service_id: 'service-updated',
                node_id: 'node-1',
                enabled: true,
            },
        ]);

        // The lock must be released after the completed refresh.
        transport.refreshOwnershipSnapshots();
        const third = await waitForSnapshotCount(capture, 3);
        expect(payloadOf(third[2]).revision).toBe(3);
        expect(findAssignedServiceIds).toHaveBeenCalledTimes(3);
    });

    it('closes with 1011 if an ownership refresh database read fails', async () => {
        findAssignedServiceIds
            .mockResolvedValueOnce(['service-initial'])
            .mockRejectedValueOnce(new Error('Refresh database unavailable'));

        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        try {
            const client = await openClient();
            const capture = captureMessages(client);

            sendHello(client);
            await capture.waitForType('node.welcome');
            await waitForSnapshotCount(capture, 1);

            const closePromise = once(client, 'close');
            transport.refreshOwnershipSnapshots();

            const [code] = await closePromise;

            expect(code).toBe(1011);
            expect(
                capture.messages.filter(
                    (message) => message.type === 'ownership.snapshot',
                ),
            ).toHaveLength(1);
            expect(transport.isNodeConnected('node-1')).toBe(false);
            expect(findAssignedServiceIds).toHaveBeenCalledTimes(2);
        } finally {
            errorSpy.mockRestore();
        }
    });

    it('closes with 1011 when an ownership refresh exceeds its deadline', async () => {
        let resolveSlowRead!: (value: string[]) => void;
        const slowRead = new Promise<string[]>((resolve) => {
            resolveSlowRead = resolve;
        });

        findAssignedServiceIds
            .mockResolvedValueOnce(['service-initial'])
            .mockImplementationOnce(() => slowRead);

        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        try {
            const client = await openClient();
            const capture = captureMessages(client);

            sendHello(client);
            await capture.waitForType('node.welcome');
            await waitForSnapshotCount(capture, 1);

            // Only the new refresh deadline uses fake timers.
            jest.useFakeTimers({
                doNotFake: ['nextTick', 'setImmediate', 'clearImmediate'],
            });

            const closePromise = once(client, 'close');
            transport.refreshOwnershipSnapshots();
            expect(findAssignedServiceIds).toHaveBeenCalledTimes(2);

            await jest.advanceTimersByTimeAsync(10_001);
            const [code] = await closePromise;

            expect(code).toBe(1011);
            expect(transport.isNodeConnected('node-1')).toBe(false);
            expect(jest.getTimerCount()).toBe(0);

            // Completing the old Prisma read cannot publish a snapshot.
            resolveSlowRead(['service-too-late']);
            await new Promise<void>((resolve) => setImmediate(resolve));
            expect(
                capture.messages.filter(
                    (message) => message.type === 'ownership.snapshot',
                ),
            ).toHaveLength(1);
        } finally {
            jest.useRealTimers();
            errorSpy.mockRestore();
        }
    });

    it('discards an in-flight ownership refresh after reconnect', async () => {
        let resolveOldRefresh!: (value: string[]) => void;

        const oldRefresh = new Promise<string[]>((resolve) => {
            resolveOldRefresh = resolve;
        });

        findAssignedServiceIds
            .mockResolvedValueOnce(['service-initial'])
            .mockImplementationOnce(() => oldRefresh)
            .mockResolvedValueOnce(['service-new-session']);

        const first = await openClient();
        const firstCapture = captureMessages(first);

        sendHello(first);
        const firstWelcome = await firstCapture.waitForType('node.welcome');
        await waitForSnapshotCount(firstCapture, 1);

        transport.refreshOwnershipSnapshots();
        expect(findAssignedServiceIds).toHaveBeenCalledTimes(2);

        const firstClosed = once(first, 'close');
        const second = await openClient();
        await firstClosed;

        const secondCapture = captureMessages(second);
        sendHello(second);

        const secondWelcome = await secondCapture.waitForType('node.welcome');
        const [secondSnapshot] = await waitForSnapshotCount(secondCapture, 1);

        resolveOldRefresh(['service-stale']);

        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });

        expect(payloadOf(secondWelcome).sessionId).not.toBe(
            payloadOf(firstWelcome).sessionId,
        );
        expect(payloadOf(secondSnapshot).revision).toBe(1);
        expect(payloadOf(secondSnapshot).assignments).toEqual([
            {
                service_id: 'service-new-session',
                node_id: 'node-1',
                enabled: true,
            },
        ]);
        expect(
            firstCapture.messages.filter(
                (message) => message.type === 'ownership.snapshot',
            ),
        ).toHaveLength(1);
        expect(
            secondCapture.messages.filter(
                (message) => message.type === 'ownership.snapshot',
            ),
        ).toHaveLength(1);
        expect(transport.isNodeConnected('node-1')).toBe(true);
    });
});

import { createServer, Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { WebSocket, type RawData } from 'ws';

import { NodesService } from '../../nodes.service';
import { createAgentEnvelope } from '../../protocol/agent-protocol';
import { AgentWebSocketServer } from '../agent-websocket.server';

const NODE_ID = 'send-test-node';
const OTHER_NODE_ID = 'other-test-node';
const TOKEN = 'send-test-token';

function installCommand() {
    return {
        commandId: 'command-install-1',
        operation: 'service.install',
        serviceId: 'service-test-1',
        parameters: {
            formatVersion: 1,
            serviceId: 'service-test-1',
            jobId: 'job-test-1',
            nodeId: NODE_ID,
            egg: {
                id: 'egg-test-1',
                key: 'nodejs-discord-bot',
                version: '1.0.0',
            },
            runtime: {
                image: 'node:22-bookworm-slim',
                startup: 'node index.js',
            },
            resources: {
                memoryMb: 512,
                cpuPercent: 10,
                diskMb: 512,
            },
            variables: [
                {
                    key: 'BOT_TOKEN',
                    required: true,
                },
            ],
        },
    };
}

describe('Agent command transport', () => {
    let httpServer: HttpServer;
    let transport: AgentWebSocketServer;
    let clients: WebSocket[];
    let port: number;

    beforeEach(async () => {
        clients = [];

        httpServer = createServer();

        const nodesService = {
            authenticateNode: jest.fn().mockImplementation(
                async (nodeId: string) => ({ id: nodeId }),
            ),
            heartbeat: jest.fn().mockResolvedValue({ ok: true }),
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

    function connect(nodeId = NODE_ID): Promise<WebSocket> {
        return new Promise((resolve, reject) => {
            const client = new WebSocket(
                `ws://127.0.0.1:${port}/agent/v1/ws`,
                {
                    headers: {
                        'x-node-id': nodeId,
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
    ): Promise<Record<string, unknown>> {
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
                let message: Record<string, unknown>;

                try {
                    message = JSON.parse(
                        data.toString('utf8'),
                    ) as Record<string, unknown>;
                } catch (error) {
                    clearTimeout(timeout);
                    client.off('message', onMessage);
                    reject(error);
                    return;
                }

                if (message.type !== expectedType) {
                    return;
                }

                clearTimeout(timeout);
                client.off('message', onMessage);
                resolve(message);
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

    it('delivers a valid install command to the correct Agent', async () => {
        const client = await connect();
        await completeHello(client);

        const received = waitForMessage(
            client,
            'command.execute',
        );

        expect(
            transport.sendCommand(NODE_ID, installCommand()),
        ).toBe(true);

        const message = await received;

        expect(message.type).toBe('command.execute');
        expect(message.payload).toEqual(installCommand());
    });

    it('rejects commands before node.hello', async () => {
        await connect();

        expect(
            transport.sendCommand(NODE_ID, installCommand()),
        ).toBe(false);
    });

    it('rejects an install command targeting a different node', async () => {
        const client = await connect();
        await completeHello(client);

        const command = installCommand();
        command.parameters.nodeId = OTHER_NODE_ID;

        expect(
            transport.sendCommand(NODE_ID, command),
        ).toBe(false);
    });

    it('rejects an invalid install payload', async () => {
        const client = await connect();
        await completeHello(client);

        const command = installCommand();

        expect(
            transport.sendCommand(NODE_ID, {
                ...command,
                parameters: {
                    ...command.parameters,
                    resources: {
                        ...command.parameters.resources,
                        memoryMb: -1,
                    },
                },
            }),
        ).toBe(false);
    });

    it('rejects commands when the node is not connected', () => {
        expect(
            transport.sendCommand(NODE_ID, installCommand()),
        ).toBe(false);
    });

    it('rejects commands after Agent disconnects', async () => {
        const client = await connect();
        await completeHello(client);

        const disconnected = new Promise<void>((resolve) => {
            client.once('close', () => resolve());
        });

        client.close();
        await disconnected;

        expect(
            transport.sendCommand(NODE_ID, installCommand()),
        ).toBe(false);
    });

    it('does not send a command to another connected Agent', async () => {
        const first = await connect(NODE_ID);
        await completeHello(first);

        const second = await connect(OTHER_NODE_ID);
        await completeHello(second);

        const receivedByFirst = waitForMessage(
            first,
            'command.execute',
        );

        expect(
            transport.sendCommand(NODE_ID, installCommand()),
        ).toBe(true);

        const message = await receivedByFirst;

        expect(message.payload).toEqual(installCommand());

        // The second Agent remains connected, but its nodeId
        // does not match the installation target.
        expect(
            transport.sendCommand(
                OTHER_NODE_ID,
                installCommand(),
            ),
        ).toBe(false);
    });

    it('rejects commands after transport shutdown', async () => {
        const client = await connect();
        await completeHello(client);

        transport.close();

        expect(
            transport.sendCommand(NODE_ID, installCommand()),
        ).toBe(false);
    });

    it('rejects a duplicate commandId in the active session', async () => {
        const client = await connect();
        await completeHello(client);

        const received = waitForMessage(
            client,
            'command.execute',
        );

        const command = installCommand();

        expect(
            transport.sendCommand(NODE_ID, command),
        ).toBe(true);

        await received;

        expect(
            transport.sendCommand(NODE_ID, command),
        ).toBe(false);
    });

    it('rejects a duplicate commandId with different parameters', async () => {
        const client = await connect();
        await completeHello(client);

        const received = waitForMessage(
            client,
            'command.execute',
        );

        const command = installCommand();

        expect(
            transport.sendCommand(NODE_ID, command),
        ).toBe(true);

        await received;

        expect(
            transport.sendCommand(NODE_ID, {
                ...command,
                serviceId: 'another-service',
                parameters: {
                    ...command.parameters,
                    serviceId: 'another-service',
                },
            }),
        ).toBe(false);
    });

    it('allows a different commandId in the same session', async () => {
        const client = await connect();
        await completeHello(client);

        const firstReceived = waitForMessage(
            client,
            'command.execute',
        );

        expect(
            transport.sendCommand(NODE_ID, installCommand()),
        ).toBe(true);

        await firstReceived;

        const secondReceived = waitForMessage(
            client,
            'command.execute',
        );

        expect(
            transport.sendCommand(NODE_ID, {
                ...installCommand(),
                commandId: 'command-install-2',
            }),
        ).toBe(true);

        const second = await secondReceived;

        expect(
            (second.payload as { commandId: string }).commandId,
        ).toBe('command-install-2');
    });

    it('cleans pending commands when a node is disconnected', async () => {
        const client = await connect();
        await completeHello(client);

        const received = waitForMessage(
            client,
            'command.execute',
        );

        expect(
            transport.sendCommand(NODE_ID, installCommand()),
        ).toBe(true);

        await received;

        transport.disconnectNode(NODE_ID);

        expect(transport.isNodeConnected(NODE_ID)).toBe(false);

        const replacement = await connect();
        await completeHello(replacement);

        const receivedAgain = waitForMessage(
            replacement,
            'command.execute',
        );

        expect(
            transport.sendCommand(NODE_ID, installCommand()),
        ).toBe(true);

        await receivedAgain;
    });

});

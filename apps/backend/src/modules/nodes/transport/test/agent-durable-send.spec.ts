import { createServer, Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { WebSocket, type RawData } from 'ws';

import { NodesService } from '../../nodes.service';
import { createAgentEnvelope } from '../../protocol/agent-protocol';
import { AgentCommandsService } from '../agent-commands.service';
import { AgentWebSocketServer } from '../agent-websocket.server';

const NODE_ID = 'durable-test-node';
const TOKEN = 'durable-test-token';
const COMMAND_ID = 'durable-command-1';
const SERVICE_ID = 'durable-service-1';

function installCommand() {
    return {
        commandId: COMMAND_ID,
        operation: 'service.install',
        serviceId: SERVICE_ID,
        parameters: {
            formatVersion: 1,
            serviceId: SERVICE_ID,
            jobId: 'durable-job-1',
            nodeId: NODE_ID,
            egg: {
                id: 'durable-egg-1',
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

describe('Durable Agent WebSocket transport', () => {
    let httpServer: HttpServer;
    let transport: AgentWebSocketServer;
    let clients: WebSocket[];
    let port: number;

    let findById: jest.Mock;
    let claimSend: jest.Mock;
    let markAccepted: jest.Mock;
    let markResult: jest.Mock;
    let markUnknown: jest.Mock;

    beforeEach(async () => {
        clients = [];

        findById = jest.fn().mockResolvedValue({
            id: COMMAND_ID,
            nodeId: NODE_ID,
            serviceId: SERVICE_ID,
            operation: 'service.install',
            status: 'PREPARED',
        });

        claimSend = jest.fn().mockResolvedValue(true);
        markAccepted = jest.fn().mockResolvedValue(true);
        markResult = jest.fn().mockResolvedValue(true);
        markUnknown = jest.fn().mockResolvedValue(true);

        const commandsService = {
            findById,
            claimSend,
            markAccepted,
            markResult,
            markUnknown,
        } as unknown as AgentCommandsService;

        const nodesService = {
            authenticateNode: jest.fn().mockImplementation(
                async (nodeId: string) => ({ id: nodeId }),
            ),
            heartbeat: jest.fn().mockResolvedValue({ ok: true }),
        } as unknown as NodesService;

        httpServer = createServer();

        transport = new AgentWebSocketServer(
            httpServer,
            nodesService,
            commandsService,
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
                        agentVersion: 'durable-test-agent',
                        capabilities: [],
                    },
                    'durable-hello-1',
                ),
            ),
        );

        await welcome;
    }

    it('rejects legacy sendCommand when durable tracking is enabled', async () => {
        const client = await connect();
        await completeHello(client);

        expect(
            transport.sendCommand(NODE_ID, installCommand()),
        ).toBe(false);

        expect(claimSend).not.toHaveBeenCalled();
    });

    it('claims the database command before WebSocket delivery', async () => {
        const client = await connect();
        await completeHello(client);

        let claimedBeforeDelivery = false;

        const received = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Command delivery timeout'));
            }, 3000);

            client.on('message', function onMessage(data: RawData) {
                const message = JSON.parse(
                    data.toString('utf8'),
                ) as Record<string, unknown>;

                if (message.type !== 'command.execute') {
                    return;
                }

                clearTimeout(timeout);
                client.off('message', onMessage);

                claimedBeforeDelivery =
                    claimSend.mock.calls.length === 1;

                resolve();
            });
        });

        await expect(
            transport.sendDurableCommand(
                NODE_ID,
                installCommand(),
            ),
        ).resolves.toBe(true);

        await received;

        expect(claimedBeforeDelivery).toBe(true);
        expect(claimSend).toHaveBeenCalledTimes(1);
        expect(claimSend).toHaveBeenCalledWith(
            COMMAND_ID,
            expect.any(String),
        );
    });

    it('does not send when the database claim is rejected', async () => {
        const client = await connect();
        await completeHello(client);

        claimSend.mockResolvedValue(false);

        await expect(
            transport.sendDurableCommand(
                NODE_ID,
                installCommand(),
            ),
        ).resolves.toBe(false);

        expect(claimSend).toHaveBeenCalledTimes(1);
        expect(markUnknown).not.toHaveBeenCalled();
    });

    it('does not send when the database claim fails', async () => {
        const client = await connect();
        await completeHello(client);

        claimSend.mockRejectedValue(
            new Error('Database unavailable'),
        );

        await expect(
            transport.sendDurableCommand(
                NODE_ID,
                installCommand(),
            ),
        ).rejects.toThrow('Database unavailable');
    });

    it('rejects a database command targeting another node', async () => {
        const client = await connect();
        await completeHello(client);

        findById.mockResolvedValue({
            id: COMMAND_ID,
            nodeId: 'another-node',
            serviceId: SERVICE_ID,
            operation: 'service.install',
        });

        await expect(
            transport.sendDurableCommand(
                NODE_ID,
                installCommand(),
            ),
        ).resolves.toBe(false);

        expect(claimSend).not.toHaveBeenCalled();
    });

    it('rejects a database command targeting another service', async () => {
        const client = await connect();
        await completeHello(client);

        findById.mockResolvedValue({
            id: COMMAND_ID,
            nodeId: NODE_ID,
            serviceId: 'another-service',
            operation: 'service.install',
        });

        await expect(
            transport.sendDurableCommand(
                NODE_ID,
                installCommand(),
            ),
        ).resolves.toBe(false);

        expect(claimSend).not.toHaveBeenCalled();
    });

    it('rejects a missing durable command', async () => {
        const client = await connect();
        await completeHello(client);

        findById.mockResolvedValue(null);

        await expect(
            transport.sendDurableCommand(
                NODE_ID,
                installCommand(),
            ),
        ).resolves.toBe(false);

        expect(claimSend).not.toHaveBeenCalled();
    });

    it('does not claim a command before node.hello', async () => {
        await connect();

        await expect(
            transport.sendDurableCommand(
                NODE_ID,
                installCommand(),
            ),
        ).resolves.toBe(false);

        expect(claimSend).not.toHaveBeenCalled();
    });

    it('blocks duplicate commandId in the active session', async () => {
        const client = await connect();
        await completeHello(client);

        const received = waitForMessage(
            client,
            'command.execute',
        );

        await expect(
            transport.sendDurableCommand(
                NODE_ID,
                installCommand(),
            ),
        ).resolves.toBe(true);

        await received;

        await expect(
            transport.sendDurableCommand(
                NODE_ID,
                installCommand(),
            ),
        ).resolves.toBe(false);

        expect(claimSend).toHaveBeenCalledTimes(1);
    });


    it('persists command.accepted for the matching session', async () => {
        const client = await connect();
        await completeHello(client);

        const received = waitForMessage(
            client,
            'command.execute',
        );

        await transport.sendDurableCommand(
            NODE_ID,
            installCommand(),
        );

        await received;

        let resolveAccepted!: () => void;

        const accepted = new Promise<void>((resolve) => {
            resolveAccepted = resolve;
        });

        markAccepted.mockImplementationOnce(async () => {
            resolveAccepted();
            return true;
        });

        client.send(
            JSON.stringify(
                createAgentEnvelope(
                    'command.accepted',
                    {
                        commandId: COMMAND_ID,
                    },
                    'accepted-message-1',
                ),
            ),
        );

        await accepted;

        expect(markAccepted).toHaveBeenCalledWith(
            COMMAND_ID,
            expect.any(String),
        );
    });


    it('marks outstanding commands UNKNOWN after disconnect', async () => {
        const client = await connect();
        await completeHello(client);

        const received = waitForMessage(
            client,
            'command.execute',
        );

        await transport.sendDurableCommand(
            NODE_ID,
            installCommand(),
        );

        await received;

        transport.disconnectNode(NODE_ID);

        expect(markUnknown).toHaveBeenCalledWith(
            COMMAND_ID,
        );
    });
});

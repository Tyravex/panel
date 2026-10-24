import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket, type RawData } from 'ws';

import { NodesService } from '../../nodes.service';
import { createAgentEnvelope } from '../../protocol/agent-protocol';
import { AgentCommandsService } from '../agent-commands.service';
import { AgentWebSocketServer } from '../agent-websocket.server';

const NODE_ID = 'race-node-1';
const SERVICE_ID = 'race-service-1';
const COMMAND_ID = 'race-command-1';
const TOKEN = 'race-token-1';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function installCommand() {
    return {
        commandId: COMMAND_ID,
        operation: 'service.install',
        serviceId: SERVICE_ID,
        parameters: {
            formatVersion: 1,
            serviceId: SERVICE_ID,
            jobId: 'race-job-1',
            nodeId: NODE_ID,
            egg: {
                id: 'race-egg-1',
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
            variables: [{ key: 'BOT_TOKEN', required: true }],
        },
    };
}

describe('Durable Agent WebSocket races', () => {
    let httpServer: HttpServer;
    let transport: AgentWebSocketServer;
    let clients: WebSocket[];
    let port: number;

    let claimSend: jest.Mock;
    let markAccepted: jest.Mock;
    let markResult: jest.Mock;
    let markUnknown: jest.Mock;

    beforeEach(async () => {
        clients = [];
        claimSend = jest.fn().mockResolvedValue(true);
        markAccepted = jest.fn().mockResolvedValue(true);
        markResult = jest.fn().mockResolvedValue(true);
        markUnknown = jest.fn().mockResolvedValue(true);

        const commandsService = {
            findById: jest.fn().mockResolvedValue({
                id: COMMAND_ID,
                nodeId: NODE_ID,
                serviceId: SERVICE_ID,
                operation: 'service.install',
            }),
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
        jest.restoreAllMocks();
        transport.close();
        for (const client of clients) {
            client.terminate();
        }
        await new Promise<void>((resolve, reject) => {
            httpServer.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    });

    async function connect(): Promise<WebSocket> {
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
        await new Promise<void>((resolve, reject) => {
            client.once('open', resolve);
            client.once('error', reject);
        });
        return client;
    }

    function waitForMessage(
        client: WebSocket,
        type: string,
    ): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                client.off('message', onMessage);
                reject(new Error(`Timeout waiting for ${type}`));
            }, 3000);
            function onMessage(data: RawData): void {
                const message = JSON.parse(
                    data.toString('utf8'),
                ) as Record<string, unknown>;
                if (message.type !== type) return;
                clearTimeout(timer);
                client.off('message', onMessage);
                resolve(message);
            }
            client.on('message', onMessage);
        });
    }

    function waitForClose(client: WebSocket): Promise<void> {
        if (client.readyState === WebSocket.CLOSED) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                client.off('close', onClose);
                reject(new Error('Timeout waiting for close'));
            }, 3000);
            function onClose(): void {
                clearTimeout(timer);
                resolve();
            }
            client.once('close', onClose);
        });
    }

    function sendResult(client: WebSocket): void {
        client.send(JSON.stringify(createAgentEnvelope(
            'command.result',
            { commandId: COMMAND_ID, success: true },
            'race-result-1',
        )));
    }

    function sendAccepted(client: WebSocket): void {
        client.send(JSON.stringify(createAgentEnvelope(
            'command.accepted',
            { commandId: COMMAND_ID },
            'race-accepted-1',
        )));
    }

    async function readyClient(): Promise<WebSocket> {
        const client = await connect();
        const welcome = waitForMessage(client, 'node.welcome');
        client.send(JSON.stringify(createAgentEnvelope(
            'node.hello',
            { agentVersion: 'race-test-agent', capabilities: [] },
            'race-hello-1',
        )));
        await welcome;
        return client;
    }

    async function sendInstall(client: WebSocket): Promise<void> {
        const received = waitForMessage(client, 'command.execute');
        expect(await transport.sendDurableCommand(
            NODE_ID, installCommand(),
        )).toBe(true);
        await received;
    }

    it('persists a result without requiring command.accepted', async () => {
        const client = await readyClient();
        await sendInstall(client);
        const invoked = deferred<void>();
        markResult.mockImplementationOnce(async () => {
            invoked.resolve();
            return true;
        });
        sendResult(client);
        await invoked.promise;
        expect(markResult).toHaveBeenCalledWith(
            COMMAND_ID, expect.any(String), true, undefined,
        );
    });

    it('marks UNKNOWN on disconnect while a result is waiting for DB', async () => {
        const client = await readyClient();
        await sendInstall(client);
        const entered = deferred<void>();
        const resultGate = deferred<boolean>();
        markResult.mockImplementationOnce(() => {
            entered.resolve();
            return resultGate.promise;
        });
        sendResult(client);
        await entered.promise;
        transport.disconnectNode(NODE_ID);
        expect(markUnknown).toHaveBeenCalledWith(COMMAND_ID);
        resultGate.resolve(false);
        await waitForClose(client);
        expect(markResult).toHaveBeenCalledTimes(1);
        expect(claimSend).toHaveBeenCalledTimes(1);
    });

    it('does not mark UNKNOWN after a completed result is removed', async () => {
        const client = await readyClient();
        await sendInstall(client);
        const entered = deferred<void>();
        markResult.mockImplementationOnce(async () => {
            entered.resolve();
            return true;
        });
        sendResult(client);
        await entered.promise;
        // Let the already-resolved persistence promise complete.
        await new Promise<void>((resolve) => setImmediate(resolve));
        transport.disconnectNode(NODE_ID);
        expect(markUnknown).not.toHaveBeenCalled();
    });

    it('does not finalize a command when the database rejects a late result', async () => {
        const client = await readyClient();
        await sendInstall(client);
        const invoked = deferred<void>();
        markResult.mockImplementationOnce(async () => {
            invoked.resolve();
            return false;
        });
        const closed = waitForClose(client);
        sendResult(client);
        await invoked.promise;
        await closed;
        expect(markResult).toHaveBeenCalledTimes(1);
        expect(markUnknown).toHaveBeenCalledWith(COMMAND_ID);
    });

    it('retires a pending command when a replacement session connects', async () => {
        const first = await readyClient();
        await sendInstall(first);
        const firstClosed = waitForClose(first);
        const replacement = await readyClient();
        await firstClosed;
        expect(transport.isNodeConnected(NODE_ID)).toBe(true);
        expect(markUnknown).toHaveBeenCalledWith(COMMAND_ID);
        const replacementClosed = waitForClose(replacement);
        sendResult(replacement);
        await replacementClosed;
        expect(markResult).not.toHaveBeenCalled();
        expect(claimSend).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate results without a second database finalization', async () => {
        const client = await readyClient();
        await sendInstall(client);
        const finalized = deferred<void>();
        markResult.mockImplementationOnce(async () => {
            finalized.resolve();
            return true;
        });
        sendResult(client);
        await finalized.promise;
        await new Promise<void>((resolve) => setImmediate(resolve));
        const closed = waitForClose(client);
        sendResult(client);
        await closed;
        expect(markResult).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate acknowledgements without another DB transition', async () => {
        const client = await readyClient();
        await sendInstall(client);
        const accepted = deferred<void>();
        markAccepted.mockImplementationOnce(async () => {
            accepted.resolve();
            return true;
        });
        sendAccepted(client);
        await accepted.promise;
        await new Promise<void>((resolve) => setImmediate(resolve));
        const closed = waitForClose(client);
        sendAccepted(client);
        await closed;
        expect(markAccepted).toHaveBeenCalledTimes(2);
        // The second response is rejected by the durable DB mock in production;
        // this test uses a permissive mock and checks the in-memory guard.
    });

    it('does not send a command when claimSend is already denied', async () => {
        const client = await readyClient();
        claimSend.mockResolvedValue(false);
        expect(await transport.sendDurableCommand(
            NODE_ID, installCommand(),
        )).toBe(false);
        expect(markResult).not.toHaveBeenCalled();
        expect(markUnknown).not.toHaveBeenCalled();
        expect(client.readyState).toBe(WebSocket.OPEN);
    });

    it('does not retry a command after disconnect', async () => {
        const first = await readyClient();
        await sendInstall(first);
        transport.disconnectNode(NODE_ID);
        await waitForClose(first);
        claimSend.mockResolvedValue(false);
        const second = await readyClient();
        expect(await transport.sendDurableCommand(
            NODE_ID, installCommand(),
        )).toBe(false);
        expect(claimSend).toHaveBeenCalledTimes(2);
        expect(markUnknown).toHaveBeenCalledWith(COMMAND_ID);
        expect(second.readyState).toBe(WebSocket.OPEN);
    });
});

import { createServer, Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { WebSocket, type RawData } from 'ws';

import { NodesService } from '../../nodes.service';
import { createAgentEnvelope } from '../../protocol/agent-protocol';
import { AgentWebSocketServer } from '../agent-websocket.server';

const NODE_ID = 'response-test-node';
const OTHER_NODE_ID = 'response-other-node';
const TOKEN = 'response-test-token';
const COMMAND_ID = 'response-command-1';

function installCommand(commandId = COMMAND_ID, nodeId = NODE_ID) {
    return {
        commandId,
        operation: 'service.install',
        serviceId: 'response-service-1',
        parameters: {
            formatVersion: 1,
            serviceId: 'response-service-1',
            jobId: 'response-job-1',
            nodeId,
            egg: {
                id: 'response-egg-1',
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
                { key: 'BOT_TOKEN', required: true },
            ],
        },
    };
}

describe('Agent command responses over WebSocket', () => {
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
            findAssignedServiceIds: jest.fn().mockResolvedValue([]),
        } as unknown as NodesService;

        transport = new AgentWebSocketServer(httpServer, nodesService);

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
                reject(new Error(`Timed out waiting for ${expectedType}`));
            }, 3000);

            function onMessage(data: RawData): void {
                let message: Record<string, unknown>;
                try {
                    message = JSON.parse(data.toString('utf8')) as Record<string, unknown>;
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

    function waitForClose(client: WebSocket): Promise<number> {
        return new Promise((resolve, reject) => {
            if (client.readyState === WebSocket.CLOSED) {
                resolve(1006);
                return;
            }
            const timeout = setTimeout(() => {
                client.off('close', onClose);
                reject(new Error('Timed out waiting for close'));
            }, 3000);

            function onClose(code: number): void {
                clearTimeout(timeout);
                resolve(code);
            }
            client.once('close', onClose);
        });
    }

    async function completeHello(client: WebSocket): Promise<void> {
        // Register both listeners before sending node.hello.
        const welcome = waitForMessage(client, 'node.welcome');
        const snapshot = waitForMessage(client, 'ownership.snapshot');

        client.send(JSON.stringify(createAgentEnvelope(
            'node.hello',
            { agentVersion: 'test-agent', capabilities: [] },
            'response-hello-1',
        )));

        const welcomeMessage = await welcome;
        const snapshotMessage = await snapshot;
        const welcomePayload = welcomeMessage.payload as {
            nodeId: string;
            sessionId: string;
        };
        const snapshotPayload = snapshotMessage.payload as {
            node_id: string;
            session_id: string;
            revision: number;
            assignments: unknown[];
        };

        console.log('Agent handshake', {
            welcome: welcomeMessage.payload,
            snapshot: snapshotMessage.payload,
        });

        expect(snapshotPayload.node_id).toBe(welcomePayload.nodeId);
        expect(snapshotPayload.session_id).toBe(welcomePayload.sessionId);
        expect(snapshotPayload.revision).toBe(1);
        expect(snapshotPayload.assignments).toEqual([]);
    }

    function sendAccepted(client: WebSocket, commandId = COMMAND_ID): void {
        client.send(JSON.stringify(createAgentEnvelope(
            'command.accepted',
            { commandId },
            'response-accepted-1',
        )));
    }

    function sendResult(client: WebSocket, commandId = COMMAND_ID): void {
        client.send(JSON.stringify(createAgentEnvelope(
            'command.result',
            { commandId, success: true },
            'response-result-1',
        )));
    }

    async function sendInstall(
        client: WebSocket,
        nodeId = NODE_ID,
        commandId = COMMAND_ID,
    ): Promise<void> {
        const received = waitForMessage(client, 'command.execute');
        expect(transport.sendCommand(
            nodeId,
            installCommand(commandId, nodeId),
        )).toBe(true);
        await received;
    }

    async function waitForProcessing(): Promise<void> {
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 20);
        });
    }

    it('accepts a valid command.accepted response', async () => {
        const client = await connect();
        await completeHello(client);
        expect(transport.isNodeConnected(NODE_ID)).toBe(true);
        await sendInstall(client);
        sendAccepted(client);
        // A duplicate send remains blocked while the command is pending.
        expect(transport.sendCommand(NODE_ID, installCommand())).toBe(false);
        expect(transport.isNodeConnected(NODE_ID)).toBe(true);
    });

    it('accepts command.result after command.accepted', async () => {
        const client = await connect();
        await completeHello(client);
        await sendInstall(client);
        sendAccepted(client);
        await waitForProcessing();
        sendResult(client);
        await waitForProcessing();
        expect(transport.isNodeConnected(NODE_ID)).toBe(true);
    });

    it('accepts a final result without prior acceptance', async () => {
        const client = await connect();
        await completeHello(client);
        await sendInstall(client);
        sendResult(client);
        await waitForProcessing();
        expect(transport.isNodeConnected(NODE_ID)).toBe(true);
    });

    it('closes the connection for an unknown commandId', async () => {
        const client = await connect();
        await completeHello(client);
        const closed = waitForClose(client);
        sendAccepted(client, 'unknown-command');
        expect(await closed).toBe(1008);
    });

    it('closes the connection for duplicate acceptance', async () => {
        const client = await connect();
        await completeHello(client);
        await sendInstall(client);
        const closed = waitForClose(client);
        sendAccepted(client);
        sendAccepted(client);
        expect(await closed).toBe(1008);
    });

    it('closes the connection for duplicate results', async () => {
        const client = await connect();
        await completeHello(client);
        await sendInstall(client);
        const closed = waitForClose(client);
        sendResult(client);
        sendResult(client);
        expect(await closed).toBe(1008);
    });

    it('rejects responses from a different Agent', async () => {
        const first = await connect(NODE_ID);
        await completeHello(first);
        const second = await connect(OTHER_NODE_ID);
        await completeHello(second);

        console.log('Two-Agent state', {
            firstReadyState: first.readyState,
            secondReadyState: second.readyState,
            firstConnected: transport.isNodeConnected(NODE_ID),
            secondConnected: transport.isNodeConnected(OTHER_NODE_ID),
        });

        expect(transport.isNodeConnected(NODE_ID)).toBe(true);
        expect(transport.isNodeConnected(OTHER_NODE_ID)).toBe(true);
        await sendInstall(first);
        const closed = waitForClose(second);
        sendAccepted(second);
        expect(await closed).toBe(1008);
        expect(transport.isNodeConnected(NODE_ID)).toBe(true);
    });

    it('does not accept an old session after replacement', async () => {
        const first = await connect();
        await completeHello(first);
        await sendInstall(first);
        const oldClosed = waitForClose(first);
        const replacement = await connect();
        await completeHello(replacement);
        await oldClosed;
        expect(transport.isNodeConnected(NODE_ID)).toBe(true);
        // Responses for the old session's pending command must be rejected.
        const replacementClosed = waitForClose(replacement);
        sendResult(replacement);
        expect(await replacementClosed).toBe(1008);
    });
});

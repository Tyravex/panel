import { WebSocket } from 'ws';

import type { AgentCommandPayload } from '../../../protocol/agent-protocol';
import { isValidAgentPayload } from '../../../protocol/agent-payload';
import { AgentCommandDispatcher } from '../agent-command-dispatcher';
import { AgentCommandsService } from '../agent-commands.service';
import { AgentPendingCommands } from '../agent-pending-commands';
import { AgentSessionRegistry } from '../../sessions/agent-session-registry';
import type { AgentSession } from '../../sessions/agent-session.types';

const NODE_ID = 'node-1';
const SERVICE_ID = 'service-1';
const COMMAND_ID = 'command-1';

function createCommand(): AgentCommandPayload {
    return {
        commandId: COMMAND_ID,
        operation: 'service.install',
        serviceId: SERVICE_ID,
        parameters: {
            formatVersion: 1,
            serviceId: SERVICE_ID,
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

function createSession(
    sessionId = 'session-1',
): AgentSession {
    const socket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
    } as unknown as WebSocket;

    return {
        sessionId,
        nodeId: NODE_ID,
        token: 'token',
        socket,
        ready: true,
        processing: false,
        lastHeartbeat: Date.now(),
        awaitingPong: false,
        ownershipRefreshPending: false,
        helloTimer: undefined,
    } as unknown as AgentSession;
}

type CommandsServiceMock = {
    findById: jest.Mock;
    claimSend: jest.Mock;
    markUnknown: jest.Mock;
};

function createCommandsService(): CommandsServiceMock {
    return {
        findById: jest.fn().mockResolvedValue({
            nodeId: NODE_ID,
            serviceId: SERVICE_ID,
            operation: 'service.install',
        }),
        claimSend: jest.fn().mockResolvedValue(true),
        markUnknown: jest.fn().mockResolvedValue(undefined),
    };
}

function createFixture(
    durable = true,
) {
    const sessions = new AgentSessionRegistry();
    const pendingCommands = new AgentPendingCommands();
    const session = createSession();

    sessions.set(session);

    const commandsService = createCommandsService();

    let closed = false;

    const dispatcher = new AgentCommandDispatcher(
        sessions,
        pendingCommands,
        durable
            ? commandsService as unknown as AgentCommandsService
            : undefined,
        (nodeId) => {
            if (closed) {
                return false;
            }

            const current = sessions.get(nodeId);

            return (
                current !== undefined &&
                current.ready &&
                current.socket.readyState === WebSocket.OPEN
            );
        },
        () => closed,
    );

    return {
        dispatcher,
        sessions,
        pendingCommands,
        session,
        commandsService,
        setClosed: (value: boolean) => {
            closed = value;
        },
    };
}

describe('AgentCommandDispatcher', () => {
    describe('legacy dispatch', () => {

        it('creates a valid install command payload', () => {
            expect(
                isValidAgentPayload(
                    'command.execute',
                    createCommand(),
                ),
            ).toBe(true);
        });

        it('rejects legacy dispatch when durable tracking is configured', () => {
            const fixture = createFixture();

            expect(
                fixture.dispatcher.sendCommand(
                    NODE_ID,
                    createCommand(),
                ),
            ).toBe(false);

            expect(
                fixture.pendingCommands.find(COMMAND_ID),
            ).toBeNull();

            expect(
                fixture.session.socket.send,
            ).not.toHaveBeenCalled();
        });

        it('registers and sends a command without durable tracking', () => {
            const fixture = createFixture(false);

            expect(
                fixture.dispatcher.sendCommand(
                    NODE_ID,
                    createCommand(),
                ),
            ).toBe(true);

            expect(
                fixture.pendingCommands.find(COMMAND_ID),
            ).toEqual(
                expect.objectContaining({
                    commandId: COMMAND_ID,
                    nodeId: NODE_ID,
                    sessionId: fixture.session.sessionId,
                }),
            );

            expect(
                fixture.session.socket.send,
            ).toHaveBeenCalledTimes(1);
        });

        it('removes pending command when legacy socket send throws', () => {
            const fixture = createFixture(false);

            jest.spyOn(
                fixture.session.socket,
                'send',
            ).mockImplementation(() => {
                throw new Error('socket failure');
            });

            expect(
                fixture.dispatcher.sendCommand(
                    NODE_ID,
                    createCommand(),
                ),
            ).toBe(false);

            expect(
                fixture.pendingCommands.find(COMMAND_ID),
            ).toBeNull();
        });
    });

    describe('durable dispatch', () => {
        it('does not send before claimSend resolves', async () => {
            const fixture = createFixture();

            let resolveClaim!: (value: boolean) => void;

            fixture.commandsService.claimSend.mockReturnValue(
                new Promise<boolean>((resolve) => {
                    resolveClaim = resolve;
                }),
            );

            const dispatch =
                fixture.dispatcher.sendDurableCommand(
                    NODE_ID,
                    createCommand(),
                );

            await Promise.resolve();
            await Promise.resolve();

            expect(
                fixture.commandsService.claimSend,
            ).toHaveBeenCalledWith(
                COMMAND_ID,
                fixture.session.sessionId,
            );

            expect(
                fixture.session.socket.send,
            ).not.toHaveBeenCalled();

            resolveClaim(true);

            await expect(dispatch).resolves.toBe(true);

            expect(
                fixture.session.socket.send,
            ).toHaveBeenCalledTimes(1);
        });

        it('does not send when durable claim is rejected', async () => {
            const fixture = createFixture();

            fixture.commandsService.claimSend
                .mockResolvedValue(false);

            await expect(
                fixture.dispatcher.sendDurableCommand(
                    NODE_ID,
                    createCommand(),
                ),
            ).resolves.toBe(false);

            expect(
                fixture.session.socket.send,
            ).not.toHaveBeenCalled();

            expect(
                fixture.pendingCommands.find(COMMAND_ID),
            ).toBeNull();
        });

        it('marks UNKNOWN if session changes after claimSend', async () => {
            const fixture = createFixture();

            fixture.commandsService.claimSend
                .mockImplementation(async () => {
                    fixture.sessions.set(
                        createSession('session-2'),
                    );

                    return true;
                });

            await expect(
                fixture.dispatcher.sendDurableCommand(
                    NODE_ID,
                    createCommand(),
                ),
            ).resolves.toBe(false);

            expect(
                fixture.commandsService.markUnknown,
            ).toHaveBeenCalledWith(COMMAND_ID);

            expect(
                fixture.session.socket.send,
            ).not.toHaveBeenCalled();

            expect(
                fixture.pendingCommands.find(COMMAND_ID),
            ).toBeNull();
        });

        it('marks UNKNOWN and removes pending when socket send throws', async () => {
            const fixture = createFixture();

            jest.spyOn(
                fixture.session.socket,
                'send',
            ).mockImplementation(() => {
                throw new Error('socket failure');
            });

            await expect(
                fixture.dispatcher.sendDurableCommand(
                    NODE_ID,
                    createCommand(),
                ),
            ).resolves.toBe(false);

            expect(
                fixture.commandsService.markUnknown,
            ).toHaveBeenCalledWith(COMMAND_ID);

            expect(
                fixture.pendingCommands.find(COMMAND_ID),
            ).toBeNull();
        });

        it('rejects duplicate pending command before durable claim', async () => {
            const fixture = createFixture();

            fixture.pendingCommands.register({
                commandId: COMMAND_ID,
                nodeId: NODE_ID,
                serviceId: SERVICE_ID,
                operation: 'service.install',
                sessionId: fixture.session.sessionId,
                createdAt: Date.now(),
            });

            await expect(
                fixture.dispatcher.sendDurableCommand(
                    NODE_ID,
                    createCommand(),
                ),
            ).resolves.toBe(false);

            expect(
                fixture.commandsService.claimSend,
            ).not.toHaveBeenCalled();

            expect(
                fixture.session.socket.send,
            ).not.toHaveBeenCalled();
        });

        it('marks UNKNOWN when transport closes after claim', async () => {
            const fixture = createFixture();

            fixture.commandsService.claimSend
                .mockImplementation(async () => {
                    fixture.setClosed(true);
                    return true;
                });

            await expect(
                fixture.dispatcher.sendDurableCommand(
                    NODE_ID,
                    createCommand(),
                ),
            ).resolves.toBe(false);

            expect(
                fixture.commandsService.markUnknown,
            ).toHaveBeenCalledWith(COMMAND_ID);

            expect(
                fixture.session.socket.send,
            ).not.toHaveBeenCalled();
        });

        it('rejects stored command identity mismatch before claiming', async () => {
            const fixture = createFixture();

            fixture.commandsService.findById
                .mockResolvedValue({
                    nodeId: 'different-node',
                    serviceId: SERVICE_ID,
                    operation: 'service.install',
                });

            await expect(
                fixture.dispatcher.sendDurableCommand(
                    NODE_ID,
                    createCommand(),
                ),
            ).resolves.toBe(false);

            expect(
                fixture.commandsService.claimSend,
            ).not.toHaveBeenCalled();

            expect(
                fixture.session.socket.send,
            ).not.toHaveBeenCalled();
        });
    });
});
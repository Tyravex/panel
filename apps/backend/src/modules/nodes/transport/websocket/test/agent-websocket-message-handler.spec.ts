import { WebSocket } from 'ws';

import {
    AgentMessageType,
    createAgentEnvelope,
} from '../../../protocol/agent-protocol';
import { NodesService } from '../../../nodes.service';
import { AgentCommandsService } from '../../commands/agent-commands.service';
import { AgentPendingCommands } from '../../commands/agent-pending-commands';
import { OwnershipSessionController } from '../../ownership/ownership-session.controller';
import { AgentSessionRegistry } from '../../sessions/agent-session-registry';
import type { AgentSession } from '../../sessions/agent-session.types';
import { AgentWebSocketMessageHandler } from '../agent-websocket-message-handler';

describe('AgentWebSocketMessageHandler', () => {
    const createDeferred = <T>() => {
        let resolve!: (value: T) => void;

        const promise = new Promise<T>((done) => {
            resolve = done;
        });

        return { promise, resolve };
    };

    const createHarness = () => {
        const socket = {
            readyState: WebSocket.OPEN,
            close: jest.fn(),
            send: jest.fn(),
        } as unknown as WebSocket;

        const session = {
            nodeId: 'node-1',
            sessionId: 'session-1',
            token: 'test-token',
            socket,
            ready: true,
            lastHeartbeat: 0,
            helloTimer: undefined,
        } as unknown as AgentSession;

        const sessions = new AgentSessionRegistry();
        const pendingCommands = new AgentPendingCommands();

        const heartbeat = jest.fn();
        const markAccepted = jest.fn();
        const markResult = jest.fn();

        const activate = jest.fn();
        const sendInitialOwnershipSnapshot = jest.fn<
            Promise<void>,
            [AgentSession]
        >().mockResolvedValue(undefined);

        let closed = false;
        let currentSession = session;

        jest.spyOn(sessions, 'isCurrent').mockImplementation(
            (candidate) => candidate === currentSession,
        );

        const ownershipSessions = {
            activate,
        } as unknown as OwnershipSessionController;

        const handler = new AgentWebSocketMessageHandler(
            { heartbeat } as unknown as NodesService,
            sessions,
            ownershipSessions,
            pendingCommands,
            {
                markAccepted,
                markResult,
            } as unknown as AgentCommandsService,
            () => closed,
            sendInitialOwnershipSnapshot,
        );

        const registerCommand = (
            commandId = 'command-1',
            sessionId = session.sessionId,
        ) => {
            const registered = pendingCommands.register({
                commandId,
                nodeId: session.nodeId,
                serviceId: 'service-1',
                operation: 'start',
                sessionId,
                createdAt: Date.now(),
            });

            expect(registered).toBe(true);
        };

        const message = (
            type: AgentMessageType,
            payload: Record<string, unknown> = {},
        ): string => {
            let validPayload = payload;

            if (type === 'node.hello') {
                validPayload = {
                    agentVersion: '0.4.0',
                    capabilities: ['docker'],
                    ...payload,
                };
            }

            if (type === 'node.heartbeat') {
                validPayload = {
                    uptimeSeconds: 100,
                    docker: {
                        available: true,
                        version: '29.2.1',
                    },
                    ...payload,
                };
            }

            return JSON.stringify(
                createAgentEnvelope(
                    type,
                    validPayload,
                    'message-1',
                ),
            );
        };

        return {
            handler,
            socket,
            session,
            sessions,
            pendingCommands,
            heartbeat,
            markAccepted,
            markResult,
            activate,
            sendInitialOwnershipSnapshot,
            registerCommand,
            message,
            setClosed: (value: boolean) => {
                closed = value;
            },
            setCurrentSession: (value: AgentSession) => {
                currentSession = value;
            },
        };
    };

    it('closes the socket for invalid JSON', async () => {
        const h = createHarness();

        await h.handler.processMessage(h.session, '{invalid');

        expect(h.socket.close).toHaveBeenCalledWith(
            1007,
            'Invalid JSON',
        );
    });

    it('requires node.hello before other messages', async () => {
        const h = createHarness();
        h.session.ready = false;

        await h.handler.processMessage(
            h.session,
            h.message('node.heartbeat'),
        );

        expect(h.socket.close).toHaveBeenCalledWith(
            1008,
            'Hello required',
        );
        expect(h.heartbeat).not.toHaveBeenCalled();
    });

    it('activates a session after node.hello', async () => {
        const h = createHarness();
        h.session.ready = false;

        await h.handler.processMessage(
            h.session,
            h.message('node.hello'),
        );

        expect(h.session.ready).toBe(true);
        expect(h.activate).toHaveBeenCalledWith(h.session);
        expect(h.socket.send).toHaveBeenCalledTimes(1);
        expect(h.sendInitialOwnershipSnapshot)
            .toHaveBeenCalledWith(h.session);

        const welcome = JSON.parse(
            (h.socket.send as jest.Mock).mock.calls[0][0] as string,
        ) as {
            type: string;
            payload: {
                nodeId: string;
                sessionId: string;
            };
        };

        expect(welcome.type).toBe('node.welcome');
        expect(welcome.payload.nodeId).toBe('node-1');
        expect(welcome.payload.sessionId).toBe('session-1');
    });

    it('ignores a heartbeat result after session replacement', async () => {
        const h = createHarness();
        const deferred = createDeferred<{ ok: boolean }>();

        h.heartbeat.mockReturnValue(deferred.promise);

        const pending = h.handler.processMessage(
            h.session,
            h.message('node.heartbeat'),
        );

        h.setCurrentSession({
            ...h.session,
            sessionId: 'session-2',
        });

        deferred.resolve({ ok: true });
        await pending;

        expect(h.socket.send).not.toHaveBeenCalled();
        expect(h.session.lastHeartbeat).toBe(0);
    });

    it('rejects command responses from another session', async () => {
        const h = createHarness();

        h.registerCommand('command-1', 'session-other');

        await h.handler.processMessage(
            h.session,
            h.message('command.accepted', {
                commandId: 'command-1',
            }),
        );

        expect(h.socket.close).toHaveBeenCalledWith(
            1008,
            'Unexpected command response',
        );
        expect(h.markAccepted).not.toHaveBeenCalled();
        expect(h.pendingCommands.find('command-1'))
            .not.toBeNull();
    });

    it('persists command acceptance before updating memory', async () => {
        const h = createHarness();
        const deferred = createDeferred<boolean>();

        h.registerCommand();
        h.markAccepted.mockReturnValue(deferred.promise);

        const acceptSpy = jest.spyOn(
            h.pendingCommands,
            'accept',
        );

        const pending = h.handler.processMessage(
            h.session,
            h.message('command.accepted', {
                commandId: 'command-1',
            }),
        );

        expect(h.markAccepted).toHaveBeenCalledWith(
            'command-1',
            'session-1',
        );

        // Persistence must finish before in-memory acknowledgement.
        expect(acceptSpy).not.toHaveBeenCalled();

        deferred.resolve(true);
        await pending;

        expect(acceptSpy).toHaveBeenCalledWith(
            'command-1',
            'session-1',
        );

        expect(
            h.pendingCommands.accept('command-1', 'session-1'),
        ).toBe('duplicate');
    });

    it('does not accept a command when persistence fails', async () => {
        const h = createHarness();

        h.registerCommand();
        h.markAccepted.mockResolvedValue(false);

        await h.handler.processMessage(
            h.session,
            h.message('command.accepted', {
                commandId: 'command-1',
            }),
        );

        expect(h.socket.close).toHaveBeenCalledWith(
            1008,
            'Unexpected command acceptance',
        );

        expect(
            h.pendingCommands.accept('command-1', 'session-1'),
        ).toBe('accepted');
    });

    it('persists command results before removing pending state', async () => {
        const h = createHarness();
        const deferred = createDeferred<boolean>();

        h.registerCommand();
        h.markResult.mockReturnValue(deferred.promise);

        const pending = h.handler.processMessage(
            h.session,
            h.message('command.result', {
                commandId: 'command-1',
                success: true,
            }),
        );

        expect(h.pendingCommands.find('command-1'))
            .not.toBeNull();

        deferred.resolve(true);
        await pending;

        expect(h.pendingCommands.find('command-1'))
            .toBeNull();
    });

    it('does not remove pending state when result persistence fails', async () => {
        const h = createHarness();

        h.registerCommand();
        h.markResult.mockResolvedValue(false);

        await h.handler.processMessage(
            h.session,
            h.message('command.result', {
                commandId: 'command-1',
                success: false,
                errorCode: 'EXECUTION_FAILED',
            }),
        );

        expect(h.socket.close).toHaveBeenCalledWith(
            1008,
            'Unexpected command result',
        );
        expect(h.pendingCommands.find('command-1'))
            .not.toBeNull();
    });

    it('does not activate a replaced session during hello', async () => {
        const h = createHarness();

        h.session.ready = false;
        h.setCurrentSession({
            ...h.session,
            sessionId: 'session-2',
        });

        await h.handler.processMessage(
            h.session,
            h.message('node.hello'),
        );

        expect(h.activate).not.toHaveBeenCalled();
        expect(h.socket.send).not.toHaveBeenCalled();
    });

    it('does not activate a session after server shutdown', async () => {
        const h = createHarness();

        h.session.ready = false;
        h.setClosed(true);

        await h.handler.processMessage(
            h.session,
            h.message('node.hello'),
        );

        expect(h.activate).not.toHaveBeenCalled();
        expect(h.socket.send).not.toHaveBeenCalled();
    });
});
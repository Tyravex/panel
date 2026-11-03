import { WebSocket } from 'ws';

import type { AgentToPanelMessage } from '../../../protocol/agent-direction';
import { createAgentEnvelope } from '../../../protocol/agent-protocol';
import { AgentSessionRegistry } from '../../sessions/agent-session-registry';
import type { AgentSession } from '../../sessions/agent-session.types';
import { AgentCommandsService } from '../agent-commands.service';
import { AgentPendingCommands } from '../agent-pending-commands';
import { AgentCommandResponseHandler } from '../agent-command-response-handler';

describe('AgentCommandResponseHandler', () => {
    const deferred = <T>() => {
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
        } as unknown as WebSocket;

        const session = {
            nodeId: 'node-1',
            sessionId: 'session-1',
            socket,
        } as AgentSession;

        const sessions = new AgentSessionRegistry();
        const pendingCommands = new AgentPendingCommands();

        const markAccepted = jest.fn();
        const markResult = jest.fn();

        let currentSession: AgentSession = session;

        jest.spyOn(sessions, 'isCurrent').mockImplementation(
            (candidate) => candidate === currentSession,
        );

        const handler = new AgentCommandResponseHandler(
            sessions,
            pendingCommands,
            {
                markAccepted,
                markResult,
            } as unknown as AgentCommandsService,
        );

        const registerCommand = (
            commandId = 'command-1',
            sessionId = session.sessionId,
            nodeId = session.nodeId,
        ) => {
            expect(
                pendingCommands.register({
                    commandId,
                    nodeId,
                    sessionId,
                    serviceId: 'service-1',
                    operation: 'start',
                    createdAt: Date.now(),
                }),
            ).toBe(true);
        };

        const message = (
            type: 'command.accepted' | 'command.result',
            payload: Record<string, unknown>,
        ): AgentToPanelMessage =>
            createAgentEnvelope(
                type,
                payload,
                'message-1',
            ) as AgentToPanelMessage;

        return {
            handler,
            socket,
            session,
            pendingCommands,
            markAccepted,
            markResult,
            registerCommand,
            message,
            setCurrentSession: (next: AgentSession) => {
                currentSession = next;
            },
        };
    };

    it('ignores responses from replaced sessions', async () => {
        const h = createHarness();
        h.registerCommand();

        h.setCurrentSession({
            ...h.session,
            sessionId: 'session-2',
        });

        await h.handler.handle(
            h.session,
            h.message('command.accepted', {
                commandId: 'command-1',
            }),
        );

        expect(h.markAccepted).not.toHaveBeenCalled();
        expect(h.socket.close).not.toHaveBeenCalled();
    });

    it('rejects responses for another command session', async () => {
        const h = createHarness();
        h.registerCommand('command-1', 'session-other');

        await h.handler.handle(
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
    });

    it('rejects responses for another node', async () => {
        const h = createHarness();
        h.registerCommand(
            'command-1',
            'session-1',
            'node-other',
        );

        await h.handler.handle(
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
    });

    it('persists acceptance before updating memory', async () => {
        const h = createHarness();
        const pendingPersistence = deferred<boolean>();

        h.registerCommand();
        h.markAccepted.mockReturnValue(
            pendingPersistence.promise,
        );

        const acceptSpy = jest.spyOn(
            h.pendingCommands,
            'accept',
        );

        const processing = h.handler.handle(
            h.session,
            h.message('command.accepted', {
                commandId: 'command-1',
            }),
        );

        expect(h.markAccepted).toHaveBeenCalledWith(
            'command-1',
            'session-1',
        );
        expect(acceptSpy).not.toHaveBeenCalled();

        pendingPersistence.resolve(true);
        await processing;

        expect(acceptSpy).toHaveBeenCalledWith(
            'command-1',
            'session-1',
        );
        expect(h.socket.close).not.toHaveBeenCalled();
    });

    it('does not acknowledge a failed database transition', async () => {
        const h = createHarness();
        h.registerCommand();

        h.markAccepted.mockResolvedValue(false);

        const acceptSpy = jest.spyOn(
            h.pendingCommands,
            'accept',
        );

        await h.handler.handle(
            h.session,
            h.message('command.accepted', {
                commandId: 'command-1',
            }),
        );

        expect(acceptSpy).not.toHaveBeenCalled();
        expect(h.socket.close).toHaveBeenCalledWith(
            1008,
            'Unexpected command acceptance',
        );
    });

    it('does not update acceptance after session replacement', async () => {
        const h = createHarness();
        const pendingPersistence = deferred<boolean>();

        h.registerCommand();
        h.markAccepted.mockReturnValue(
            pendingPersistence.promise,
        );

        const acceptSpy = jest.spyOn(
            h.pendingCommands,
            'accept',
        );

        const processing = h.handler.handle(
            h.session,
            h.message('command.accepted', {
                commandId: 'command-1',
            }),
        );

        h.setCurrentSession({
            ...h.session,
            sessionId: 'session-2',
        });

        pendingPersistence.resolve(true);
        await processing;

        expect(acceptSpy).not.toHaveBeenCalled();
    });

    it('persists a result before removing pending state', async () => {
        const h = createHarness();
        const pendingPersistence = deferred<boolean>();

        h.registerCommand();
        h.markResult.mockReturnValue(
            pendingPersistence.promise,
        );

        const processing = h.handler.handle(
            h.session,
            h.message('command.result', {
                commandId: 'command-1',
                success: true,
            }),
        );

        expect(h.markResult).toHaveBeenCalledWith(
            'command-1',
            'session-1',
            true,
            undefined,
        );

        expect(
            h.pendingCommands.find('command-1'),
        ).not.toBeNull();

        pendingPersistence.resolve(true);
        await processing;

        expect(
            h.pendingCommands.find('command-1'),
        ).toBeNull();
    });

    it('retains pending state when result persistence fails', async () => {
        const h = createHarness();
        h.registerCommand();

        h.markResult.mockResolvedValue(false);

        await h.handler.handle(
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
        expect(
            h.pendingCommands.find('command-1'),
        ).not.toBeNull();
    });

    it('accepts a result without prior acknowledgement', async () => {
        const h = createHarness();
        h.registerCommand();

        h.markResult.mockResolvedValue(true);

        await h.handler.handle(
            h.session,
            h.message('command.result', {
                commandId: 'command-1',
                success: true,
            }),
        );

        expect(
            h.pendingCommands.find('command-1'),
        ).toBeNull();
        expect(h.socket.close).not.toHaveBeenCalled();
    });

    it('rejects duplicate command acceptance', async () => {
        const h = createHarness();
        h.registerCommand();

        expect(
            h.pendingCommands.accept('command-1', 'session-1'),
        ).toBe('accepted');

        h.markAccepted.mockResolvedValue(true);

        await h.handler.handle(
            h.session,
            h.message('command.accepted', {
                commandId: 'command-1',
            }),
        );

        expect(h.socket.close).toHaveBeenCalledWith(
            1008,
            'Unexpected command acceptance',
        );
    });
});
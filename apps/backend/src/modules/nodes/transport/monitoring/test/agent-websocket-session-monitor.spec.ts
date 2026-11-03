import { WebSocket } from 'ws';

import { AgentCommandsService } from '../../commands/agent-commands.service';
import { AgentPendingCommands } from '../../commands/agent-pending-commands';
import { AgentSessionRegistry } from '../../sessions/agent-session-registry';
import { AgentCommandRetirement } from '../../commands/agent-command-retirement';
import type { AgentSession } from '../../sessions/agent-session.types';
import {
    COMMAND_RESPONSE_TIMEOUT_MS,
    HEARTBEAT_TIMEOUT_MS,
} from '../../websocket/agent-websocket.constants';
import { AgentWebSocketSessionMonitor } from '../agent-websocket-session-monitor';

const NOW = 1_000_000;

function createSession(
    nodeId = 'node-1',
    overrides: Partial<AgentSession> = {},
): AgentSession {
    const socket = {
        readyState: WebSocket.OPEN,
        ping: jest.fn(),
        terminate: jest.fn(),
    } as unknown as WebSocket;

    return {
        sessionId: `session-${nodeId}`,
        nodeId,
        socket,
        ready: true,
        lastHeartbeat: NOW,
        awaitingPong: false,
        ...overrides,
    } as AgentSession;
}

function createFixture() {
    const sessions = new AgentSessionRegistry();
    const pendingCommands = new AgentPendingCommands();

    const markUnknown = jest.fn().mockResolvedValue(undefined);

    const agentCommandsService = {
        markUnknown,
    } as unknown as AgentCommandsService;

    const commandRetirement = new AgentCommandRetirement(
        pendingCommands,
        agentCommandsService,
    );

    const monitor = new AgentWebSocketSessionMonitor(
        sessions,
        pendingCommands,
        commandRetirement,
    );

    return {
        sessions,
        pendingCommands,
        markUnknown,
        monitor,
    };
}

function registerCommand(
    pendingCommands: AgentPendingCommands,
    commandId: string,
    createdAt: number,
): void {
    const registered = pendingCommands.register({
        commandId,
        nodeId: 'node-1',
        serviceId: 'service-1',
        operation: 'start',
        sessionId: 'session-node-1',
        createdAt,
    });

    expect(registered).toBe(true);
}

describe('AgentWebSocketSessionMonitor', () => {
    let nowSpy: jest.SpyInstance;

    beforeEach(() => {
        nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    });

    afterEach(() => {
        nowSpy.mockRestore();
        jest.restoreAllMocks();
    });

    it('pings an open, healthy session', () => {
        const fixture = createFixture();
        const session = createSession();

        fixture.sessions.set(session);
        fixture.monitor.checkSessions();

        expect(session.socket.ping).toHaveBeenCalledTimes(1);
        expect(session.socket.terminate).not.toHaveBeenCalled();
        expect(session.awaitingPong).toBe(true);
    });

    it('ignores sockets that are not open', () => {
        const fixture = createFixture();

        const session = createSession('closed-node', {
            socket: {
                readyState: WebSocket.CLOSED,
                ping: jest.fn(),
                terminate: jest.fn(),
            } as unknown as WebSocket,
        });

        fixture.sessions.set(session);
        fixture.monitor.checkSessions();

        expect(session.socket.ping).not.toHaveBeenCalled();
        expect(session.socket.terminate).not.toHaveBeenCalled();
        expect(session.awaitingPong).toBe(false);
    });

    it('terminates a session after heartbeat timeout', () => {
        const fixture = createFixture();

        const session = createSession('stale-node', {
            lastHeartbeat: NOW - HEARTBEAT_TIMEOUT_MS - 1,
        });

        fixture.sessions.set(session);
        fixture.monitor.checkSessions();

        expect(session.socket.terminate).toHaveBeenCalledTimes(1);
        expect(session.socket.ping).not.toHaveBeenCalled();
    });

    it('does not terminate exactly at heartbeat timeout', () => {
        const fixture = createFixture();

        const session = createSession('boundary-node', {
            lastHeartbeat: NOW - HEARTBEAT_TIMEOUT_MS,
        });

        fixture.sessions.set(session);
        fixture.monitor.checkSessions();

        expect(session.socket.terminate).not.toHaveBeenCalled();
        expect(session.socket.ping).toHaveBeenCalledTimes(1);
    });

    it('terminates a session awaiting pong', () => {
        const fixture = createFixture();

        const session = createSession('missing-pong-node', {
            awaitingPong: true,
        });

        fixture.sessions.set(session);
        fixture.monitor.checkSessions();

        expect(session.socket.terminate).toHaveBeenCalledTimes(1);
        expect(session.socket.ping).not.toHaveBeenCalled();
    });

    it('expires commands and marks their outcome UNKNOWN', () => {
        const fixture = createFixture();

        registerCommand(
            fixture.pendingCommands,
            'expired-command',
            NOW - COMMAND_RESPONSE_TIMEOUT_MS,
        );

        registerCommand(
            fixture.pendingCommands,
            'active-command',
            NOW - COMMAND_RESPONSE_TIMEOUT_MS + 1,
        );

        fixture.monitor.checkSessions();

        expect(fixture.markUnknown).toHaveBeenCalledTimes(1);
        expect(fixture.markUnknown).toHaveBeenCalledWith(
            'expired-command',
        );

        expect(
            fixture.pendingCommands.find('expired-command'),
        ).toBeNull();

        expect(
            fixture.pendingCommands.find('active-command'),
        ).not.toBeNull();
    });

    it('expires commands without durable tracking', () => {
        const sessions = new AgentSessionRegistry();
        const pendingCommands = new AgentPendingCommands();

        registerCommand(
            pendingCommands,
            'expired-command',
            NOW - COMMAND_RESPONSE_TIMEOUT_MS,
        );

        const commandRetirement = new AgentCommandRetirement(
            pendingCommands,
            undefined,
        );

        const monitor = new AgentWebSocketSessionMonitor(
            sessions,
            pendingCommands,
            commandRetirement,
        );

        expect(() => monitor.checkSessions()).not.toThrow();

        expect(
            pendingCommands.find('expired-command'),
        ).toBeNull();
    });

    it('logs a failed UNKNOWN transition without throwing', async () => {
        const fixture = createFixture();
        const error = new Error('database unavailable');

        fixture.markUnknown.mockRejectedValue(error);

        registerCommand(
            fixture.pendingCommands,
            'failed-transition',
            NOW - COMMAND_RESPONSE_TIMEOUT_MS,
        );

        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        fixture.monitor.checkSessions();

        await Promise.resolve();
        await Promise.resolve();

        expect(consoleSpy).toHaveBeenCalledWith(
            'Failed to mark Agent command UNKNOWN',
            {
                commandId: 'failed-transition',
                error,
            },
        );

        expect(
            fixture.pendingCommands.find('failed-transition'),
        ).toBeNull();
    });

    it('does not expire commands before the deadline', () => {
        const fixture = createFixture();

        registerCommand(
            fixture.pendingCommands,
            'fresh-command',
            NOW - COMMAND_RESPONSE_TIMEOUT_MS + 1,
        );

        fixture.monitor.checkSessions();

        expect(fixture.markUnknown).not.toHaveBeenCalled();

        expect(
            fixture.pendingCommands.find('fresh-command'),
        ).not.toBeNull();
    });
});
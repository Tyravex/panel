import { WebSocket } from 'ws';

import { AgentSessionRegistry } from '../../sessions/agent-session-registry';
import type { AgentSession } from '../../sessions/agent-session.types';
import { OwnershipSnapshotSender } from '../ownership-snapshot-sender';
import { OwnershipSessionController } from '../ownership-session.controller';
import { OWNERSHIP_BUILD_TIMEOUT_MS } from '../../websocket/agent-websocket.constants';

const NODE_ID = 'ownership-test-node';
const MESSAGE = '{"type":"ownership.snapshot"}';

function createSession(
    sessionId = 'session-1',
): AgentSession {
    const socket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        close: jest.fn(),
    } as unknown as WebSocket;

    return {
        sessionId,
        nodeId: NODE_ID,
        socket,
        ready: true,
        ownershipRefreshPending: false,
    } as AgentSession;
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

function createFixture() {
    const sessions = new AgentSessionRegistry();
    const session = createSession();
    sessions.set(session);

    const ownershipSessions = {
        isActive: jest.fn().mockReturnValue(true),
        build: jest.fn().mockResolvedValue(MESSAGE),
    };

    let closed = false;

    const sender = new OwnershipSnapshotSender(
        sessions,
        ownershipSessions as unknown as OwnershipSessionController,
        () => closed,
    );

    return {
        sender,
        sessions,
        session,
        ownershipSessions,
        setClosed: (value: boolean) => {
            closed = value;
        },
    };
}

describe('OwnershipSnapshotSender', () => {
    it('sends a successfully built snapshot', async () => {
        const fixture = createFixture();

        await fixture.sender.sendInitialOwnershipSnapshot(
            fixture.session,
        );

        expect(
            fixture.ownershipSessions.build,
        ).toHaveBeenCalledWith(fixture.session);

        expect(
            fixture.session.socket.send,
        ).toHaveBeenCalledWith(MESSAGE);

        expect(
            fixture.session.ownershipRefreshPending,
        ).toBe(false);
    });

    it('does not send when builder returns null', async () => {
        const fixture = createFixture();

        fixture.ownershipSessions.build.mockResolvedValue(null);

        await fixture.sender.sendInitialOwnershipSnapshot(
            fixture.session,
        );

        expect(
            fixture.session.socket.send,
        ).not.toHaveBeenCalled();

        expect(
            fixture.session.socket.close,
        ).not.toHaveBeenCalled();
    });

    it('prevents concurrent builds for the same session', async () => {
        const fixture = createFixture();
        const build = deferred<string | null>();

        fixture.ownershipSessions.build.mockReturnValue(
            build.promise,
        );

        const first =
            fixture.sender.sendInitialOwnershipSnapshot(
                fixture.session,
            );

        const second =
            fixture.sender.sendInitialOwnershipSnapshot(
                fixture.session,
            );

        expect(
            fixture.ownershipSessions.build,
        ).toHaveBeenCalledTimes(1);

        await second;

        build.resolve(MESSAGE);
        await first;

        expect(
            fixture.session.socket.send,
        ).toHaveBeenCalledTimes(1);
    });

    it('does not send after session replacement', async () => {
        const fixture = createFixture();
        const build = deferred<string | null>();

        fixture.ownershipSessions.build.mockReturnValue(
            build.promise,
        );

        const sending =
            fixture.sender.sendInitialOwnershipSnapshot(
                fixture.session,
            );

        fixture.sessions.set(createSession('session-2'));

        build.resolve(MESSAGE);
        await sending;

        expect(
            fixture.session.socket.send,
        ).not.toHaveBeenCalled();

        expect(
            fixture.session.socket.close,
        ).not.toHaveBeenCalled();
    });

    it('does not close a replacement session on stale build failure', async () => {
        const fixture = createFixture();
        const build = deferred<string | null>();

        fixture.ownershipSessions.build.mockReturnValue(
            build.promise,
        );

        const sending =
            fixture.sender.sendInitialOwnershipSnapshot(
                fixture.session,
            );

        fixture.sessions.set(createSession('session-2'));

        build.reject(new Error('database failure'));
        await sending;

        expect(
            fixture.session.socket.close,
        ).not.toHaveBeenCalled();
    });

    it('does not send when transport closes during build', async () => {
        const fixture = createFixture();
        const build = deferred<string | null>();

        fixture.ownershipSessions.build.mockReturnValue(
            build.promise,
        );

        const sending =
            fixture.sender.sendInitialOwnershipSnapshot(
                fixture.session,
            );

        fixture.setClosed(true);

        build.resolve(MESSAGE);
        await sending;

        expect(
            fixture.session.socket.send,
        ).not.toHaveBeenCalled();
    });

    it('closes current socket when snapshot preparation fails', async () => {
        const fixture = createFixture();
        const error = new Error('database failure');

        fixture.ownershipSessions.build.mockRejectedValue(error);

        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        try {
            await fixture.sender.sendInitialOwnershipSnapshot(
                fixture.session,
            );

            expect(
                fixture.session.socket.close,
            ).toHaveBeenCalledWith(
                1011,
                'Ownership unavailable',
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to prepare ownership snapshot',
                {
                    nodeId: NODE_ID,
                    error,
                },
            );
        } finally {
            consoleSpy.mockRestore();
        }
    });

    it('closes current socket when snapshot build times out', async () => {
        jest.useFakeTimers();

        const fixture = createFixture();

        fixture.ownershipSessions.build.mockReturnValue(
            new Promise<string | null>(() => undefined),
        );

        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        try {
            const sending =
                fixture.sender.sendInitialOwnershipSnapshot(
                    fixture.session,
                );

            await jest.advanceTimersByTimeAsync(
                OWNERSHIP_BUILD_TIMEOUT_MS,
            );

            await sending;

            expect(
                fixture.session.socket.close,
            ).toHaveBeenCalledWith(
                1011,
                'Ownership unavailable',
            );

            expect(
                fixture.session.ownershipRefreshPending,
            ).toBe(false);
        } finally {
            consoleSpy.mockRestore();
            jest.useRealTimers();
        }
    });

    it('refreshes only ready, active, open sessions', async () => {
        const fixture = createFixture();

        const inactive = createSession('session-inactive');
        inactive.nodeId = 'inactive-node';

        const notReady = createSession('session-not-ready');
        notReady.nodeId = 'not-ready-node';
        notReady.ready = false;

        const disconnected = createSession('session-disconnected');
        disconnected.nodeId = 'disconnected-node';

        Object.defineProperty(disconnected.socket, 'readyState', {
            value: WebSocket.CLOSED,
        });

        fixture.sessions.set(inactive);
        fixture.sessions.set(notReady);
        fixture.sessions.set(disconnected);

        fixture.ownershipSessions.isActive.mockImplementation(
            (session: AgentSession) =>
                session.nodeId !== 'inactive-node',
        );

        fixture.sender.refreshOwnershipSnapshots();

        await Promise.resolve();
        await Promise.resolve();

        expect(
            fixture.ownershipSessions.build,
        ).toHaveBeenCalledTimes(1);

        expect(
            fixture.ownershipSessions.build,
        ).toHaveBeenCalledWith(fixture.session);

        expect(
            fixture.session.socket.send,
        ).toHaveBeenCalledWith(MESSAGE);
    });

    it('does not refresh after transport shutdown', () => {
        const fixture = createFixture();

        fixture.setClosed(true);
        fixture.sender.refreshOwnershipSnapshots();

        expect(
            fixture.ownershipSessions.build,
        ).not.toHaveBeenCalled();
    });
});
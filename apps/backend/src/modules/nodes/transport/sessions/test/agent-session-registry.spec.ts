import type { AgentSession } from '../agent-session.types';
import { AgentSessionRegistry } from '../agent-session-registry';

describe('AgentSessionRegistry', () => {
    let registry: AgentSessionRegistry;

    const createSession = (
        nodeId: string,
        sessionId: string,
    ): AgentSession =>
        ({
            nodeId,
            sessionId,
        }) as AgentSession;

    beforeEach(() => {
        registry = new AgentSessionRegistry();
    });

    it('stores and retrieves a session', () => {
        const session = createSession('node-1', 'session-1');

        registry.set(session);

        expect(registry.get('node-1')).toBe(session);
        expect(registry.isCurrent(session)).toBe(true);
    });

    it('replaces the previous session for the same node', () => {
        const oldSession = createSession('node-1', 'session-1');
        const newSession = createSession('node-1', 'session-2');

        registry.set(oldSession);
        registry.set(newSession);

        expect(registry.get('node-1')).toBe(newSession);
        expect(registry.isCurrent(oldSession)).toBe(false);
        expect(registry.isCurrent(newSession)).toBe(true);
    });

    it('does not allow an old session to delete a new session', () => {
        const oldSession = createSession('node-1', 'session-1');
        const newSession = createSession('node-1', 'session-2');

        registry.set(oldSession);
        registry.set(newSession);

        expect(registry.deleteIfCurrent(oldSession)).toBe(false);
        expect(registry.get('node-1')).toBe(newSession);
    });

    it('compares session identity, not only sessionId', () => {
        const current = createSession('node-1', 'same-id');
        const stale = createSession('node-1', 'same-id');

        registry.set(current);

        expect(registry.isCurrent(stale)).toBe(false);
        expect(registry.deleteIfCurrent(stale)).toBe(false);
        expect(registry.get('node-1')).toBe(current);
    });

    it('deletes the current session', () => {
        const session = createSession('node-1', 'session-1');

        registry.set(session);

        expect(registry.deleteIfCurrent(session)).toBe(true);
        expect(registry.get('node-1')).toBeUndefined();
        expect(registry.deleteIfCurrent(session)).toBe(false);
    });

    it('keeps sessions of different nodes independent', () => {
        const first = createSession('node-1', 'session-1');
        const second = createSession('node-2', 'session-2');

        registry.set(first);
        registry.set(second);
        registry.deleteIfCurrent(first);

        expect(registry.get('node-1')).toBeUndefined();
        expect(registry.get('node-2')).toBe(second);
    });

    it('iterates over current sessions', () => {
        const first = createSession('node-1', 'session-1');
        const second = createSession('node-2', 'session-2');

        registry.set(first);
        registry.set(second);

        expect(Array.from(registry.values())).toEqual([first, second]);
    });

    it('clears all sessions', () => {
        registry.set(createSession('node-1', 'session-1'));
        registry.set(createSession('node-2', 'session-2'));

        registry.clear();

        expect(Array.from(registry.values())).toEqual([]);
    });
});
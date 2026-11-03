import type { AgentSession } from './agent-session.types';

export class AgentSessionRegistry {
    private readonly sessions = new Map<string, AgentSession>();

    get(nodeId: string): AgentSession | undefined {
        return this.sessions.get(nodeId);
    }

    set(session: AgentSession): void {
        this.sessions.set(session.nodeId, session);
    }

    isCurrent(session: AgentSession): boolean {
        return this.sessions.get(session.nodeId) === session;
    }

    deleteIfCurrent(session: AgentSession): boolean {
        if (!this.isCurrent(session)) {
            return false;
        }

        return this.sessions.delete(session.nodeId);
    }

    values(): IterableIterator<AgentSession> {
        return this.sessions.values();
    }

    clear(): void {
        this.sessions.clear();
    }
}
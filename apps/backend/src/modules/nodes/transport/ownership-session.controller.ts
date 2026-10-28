import {
    OwnershipSnapshot,
    serializeOwnershipSnapshot,
} from '../protocol/ownership-contract';
import { OwnershipSnapshotBuilder } from './ownership-snapshot.builder';

export interface OwnershipSession {
    nodeId: string;
    sessionId: string;
}

export class OwnershipSessionController {
    private readonly sessions = new Map<
        string,
        {
            session: OwnershipSession;
            revision: number;
        }
    >();

    constructor(
        private readonly builder: OwnershipSnapshotBuilder,
    ) {}

    activate(session: OwnershipSession): void {
        this.sessions.set(session.nodeId, {
            session,
            revision: 0,
        });
    }

    revoke(session: OwnershipSession): void {
        const current = this.sessions.get(session.nodeId);

        if (current?.session === session) {
            this.sessions.delete(session.nodeId);
        }
    }

    isActive(session: OwnershipSession): boolean {
        return this.sessions.get(session.nodeId)?.session === session;
    }

    async build(
        session: OwnershipSession,
    ): Promise<string | null> {
        const current = this.sessions.get(session.nodeId);

        if (!current || current.session !== session) {
            return null;
        }

        // Reserve the revision before the asynchronous database read.
        // Concurrent builds must never receive the same revision.
        const revision = ++current.revision;

        if (!Number.isSafeInteger(revision)) {
            throw new Error('Ownership revision exhausted');
        }

        const snapshot: OwnershipSnapshot =
            await this.builder.build(
                session.nodeId,
                session.sessionId,
                revision,
            );

        // A database read may finish after a reconnect or revocation.
        if (this.sessions.get(session.nodeId) !== current) {
            return null;
        }

        // An older database read must not overtake a newer snapshot.
        if (current.revision !== revision) {
            return null;
        }

        return serializeOwnershipSnapshot(snapshot);
    }
}

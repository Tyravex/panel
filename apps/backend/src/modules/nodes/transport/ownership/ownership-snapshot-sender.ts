import { WebSocket } from 'ws';

import { AgentSessionRegistry } from '../sessions/agent-session-registry';
import type { AgentSession } from '../sessions/agent-session.types';
import { OWNERSHIP_BUILD_TIMEOUT_MS } from '../websocket/agent-websocket.constants';
import { OwnershipSessionController } from './ownership-session.controller';

export class OwnershipSnapshotSender {
    constructor(
        private readonly sessions: AgentSessionRegistry,
        private readonly ownershipSessions: OwnershipSessionController,
        private readonly isClosed: () => boolean,
    ) { }

    refreshOwnershipSnapshots(): void {
        if (this.isClosed()) {
            return;
        }

        for (const session of this.sessions.values()) {
            if (
                !session.ready ||
                session.socket.readyState !== WebSocket.OPEN ||
                !this.ownershipSessions.isActive(session)
            ) {
                continue;
            }

            void this.sendInitialOwnershipSnapshot(session);
        }
    }

    async sendInitialOwnershipSnapshot(
        session: AgentSession,
    ): Promise<void> {
        if (session.ownershipRefreshPending) {
            return;
        }

        session.ownershipRefreshPending = true;

        try {
            let timeout: NodeJS.Timeout | undefined;

            // Promise.race does not cancel Prisma. A late result must
            // never escape the session fence or be sent after the deadline.
            const build = this.ownershipSessions.build(session);

            const deadline = new Promise<never>((_resolve, reject) => {
                timeout = setTimeout(() => {
                    reject(
                        new Error('Ownership snapshot build timed out'),
                    );
                }, OWNERSHIP_BUILD_TIMEOUT_MS);

                timeout.unref();
            });

            let message: string | null;

            try {
                message = await Promise.race([build, deadline]);
            } finally {
                if (timeout) {
                    clearTimeout(timeout);
                }
            }

            if (message === null) {
                return;
            }

            // No await between the session fence and the socket send.
            if (
                this.isClosed() ||
                !this.sessions.isCurrent(session) ||
                !this.ownershipSessions.isActive(session) ||
                !session.ready ||
                session.socket.readyState !== WebSocket.OPEN
            ) {
                return;
            }

            session.socket.send(message);
        } catch (error: unknown) {
            // An old session must not close a replacement connection.
            if (
                this.isClosed() ||
                !this.sessions.isCurrent(session) ||
                !this.ownershipSessions.isActive(session)
            ) {
                return;
            }

            console.error('Failed to prepare ownership snapshot', {
                nodeId: session.nodeId,
                error,
            });

            // Never substitute a database failure with empty rights.
            if (session.socket.readyState === WebSocket.OPEN) {
                session.socket.close(1011, 'Ownership unavailable');
            }
        } finally {
            session.ownershipRefreshPending = false;
        }
    }
}
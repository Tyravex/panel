export type PendingAgentCommand = {
    commandId: string;
    nodeId: string;
    serviceId: string;
    operation: string;
    sessionId: string;
    createdAt: number;
};

type TrackedCommand = PendingAgentCommand & {
    accepted: boolean;
};

export type AgentCommandResponseStatus =
    | 'accepted'
    | 'completed'
    | 'unknown'
    | 'wrong-session'
    | 'duplicate';

export class AgentPendingCommands {
    private readonly commands = new Map<string, TrackedCommand>();

    register(command: PendingAgentCommand): boolean {
        if (
            !command.commandId.trim() ||
            !command.nodeId.trim() ||
            !command.serviceId.trim() ||
            !command.operation.trim() ||
            !command.sessionId.trim() ||
            !Number.isSafeInteger(command.createdAt) ||
            command.createdAt < 0 ||
            this.commands.has(command.commandId)
        ) {
            return false;
        }

        this.commands.set(command.commandId, {
            ...command,
            accepted: false,
        });

        return true;
    }

    find(commandId: string): PendingAgentCommand | null {
        const command = this.commands.get(commandId);

        if (!command) {
            return null;
        }

        const {
            accepted: _accepted,
            ...pending
        } = command;

        return { ...pending };
    }

    accept(
        commandId: string,
        sessionId: string,
    ): AgentCommandResponseStatus {
        const command = this.commands.get(commandId);

        if (!command) {
            return 'unknown';
        }

        if (command.sessionId !== sessionId) {
            return 'wrong-session';
        }

        if (command.accepted) {
            return 'duplicate';
        }

        command.accepted = true;

        return 'accepted';
    }

    complete(
        commandId: string,
        sessionId: string,
    ): AgentCommandResponseStatus {
        const command = this.commands.get(commandId);

        if (!command) {
            return 'unknown';
        }

        if (command.sessionId !== sessionId) {
            return 'wrong-session';
        }

        // A result may arrive without a preceding accepted message.
        // A valid result is terminal for this in-memory command.
        this.commands.delete(commandId);

        return 'completed';
    }

    remove(
        commandId: string,
        sessionId: string,
    ): boolean {
        const command = this.commands.get(commandId);

        if (!command || command.sessionId !== sessionId) {
            return false;
        }

        return this.commands.delete(commandId);
    }

    /**
     * Removes commands associated with one WebSocket session
     * and returns their identities for durable reconciliation.
     *
     * Removal from memory does not prove execution failed.
     */
    drainSession(sessionId: string): PendingAgentCommand[] {
        const removed: PendingAgentCommand[] = [];

        for (const [commandId, command] of this.commands) {
            if (command.sessionId !== sessionId) {
                continue;
            }

            const {
                accepted: _accepted,
                ...pending
            } = command;

            removed.push({ ...pending });
            this.commands.delete(commandId);
        }

        return removed;
    }

    removeSession(sessionId: string): void {
        this.drainSession(sessionId);
    }

    expire(
        now: number,
        timeoutMs: number,
    ): PendingAgentCommand[] {
        if (
            !Number.isSafeInteger(now) ||
            !Number.isSafeInteger(timeoutMs) ||
            timeoutMs <= 0
        ) {
            return [];
        }

        const expired: PendingAgentCommand[] = [];

        for (const [commandId, command] of this.commands) {
            if (now - command.createdAt < timeoutMs) {
                continue;
            }

            const {
                accepted: _accepted,
                ...pending
            } = command;

            expired.push({ ...pending });
            this.commands.delete(commandId);
        }

        return expired;
    }

    clear(): void {
        this.commands.clear();
    }
}

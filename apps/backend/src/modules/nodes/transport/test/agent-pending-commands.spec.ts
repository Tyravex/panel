import {
    AgentPendingCommands,
    type PendingAgentCommand,
} from '../agent-pending-commands';

function makeCommand(
    overrides: Partial<PendingAgentCommand> = {},
): PendingAgentCommand {
    return {
        commandId: 'command-1',
        nodeId: 'node-1',
        serviceId: 'service-1',
        operation: 'service.install',
        sessionId: 'session-1',
        createdAt: 1000,
        ...overrides,
    };
}

describe('AgentPendingCommands', () => {
    let registry: AgentPendingCommands;

    beforeEach(() => {
        registry = new AgentPendingCommands();
    });

    it('registers and finds a command', () => {
        expect(registry.register(makeCommand())).toBe(true);

        expect(registry.find('command-1')).toEqual(
            makeCommand(),
        );
    });

    it('rejects duplicate commandId', () => {
        expect(registry.register(makeCommand())).toBe(true);

        expect(
            registry.register(
                makeCommand({
                    sessionId: 'session-2',
                }),
            ),
        ).toBe(false);
    });

    it('rejects invalid identifiers', () => {
        expect(
            registry.register(
                makeCommand({ commandId: ' ' }),
            ),
        ).toBe(false);

        expect(
            registry.register(
                makeCommand({ sessionId: '' }),
            ),
        ).toBe(false);
    });

    it('does not expose mutable internal records', () => {
        registry.register(makeCommand());

        const found = registry.find('command-1');

        expect(found).not.toBeNull();

        if (!found) {
            throw new Error('Command not found');
        }

        found.nodeId = 'modified';

        expect(registry.find('command-1')?.nodeId).toBe(
            'node-1',
        );
    });

    it('removes a command only for its session', () => {
        registry.register(makeCommand());

        expect(
            registry.remove('command-1', 'session-2'),
        ).toBe(false);

        expect(registry.find('command-1')).not.toBeNull();

        expect(
            registry.remove('command-1', 'session-1'),
        ).toBe(true);

        expect(registry.find('command-1')).toBeNull();
    });

    it('removes only commands belonging to a session', () => {
        registry.register(makeCommand());

        registry.register(
            makeCommand({
                commandId: 'command-2',
                sessionId: 'session-2',
            }),
        );

        registry.removeSession('session-1');

        expect(registry.find('command-1')).toBeNull();
        expect(registry.find('command-2')).not.toBeNull();
    });

    it('clears all commands', () => {
        registry.register(makeCommand());

        registry.clear();

        expect(registry.find('command-1')).toBeNull();
    });

    it('returns null for unknown commands', () => {
        expect(registry.find('unknown')).toBeNull();
    });

    it('accepts a command only once', () => {
        registry.register(makeCommand());

        expect(
            registry.accept('command-1', 'session-1'),
        ).toBe('accepted');

        expect(
            registry.accept('command-1', 'session-1'),
        ).toBe('duplicate');
    });

    it('rejects acceptance from another session', () => {
        registry.register(makeCommand());

        expect(
            registry.accept('command-1', 'session-2'),
        ).toBe('wrong-session');

        expect(
            registry.accept('command-1', 'session-1'),
        ).toBe('accepted');
    });

    it('completes a command and removes it', () => {
        registry.register(makeCommand());

        expect(
            registry.complete('command-1', 'session-1'),
        ).toBe('completed');

        expect(registry.find('command-1')).toBeNull();

        expect(
            registry.complete('command-1', 'session-1'),
        ).toBe('unknown');
    });

    it('rejects completion from another session', () => {
        registry.register(makeCommand());

        expect(
            registry.complete('command-1', 'session-2'),
        ).toBe('wrong-session');

        expect(registry.find('command-1')).not.toBeNull();
    });

    it('accepts a final result without prior acceptance', () => {
        registry.register(makeCommand());

        expect(
            registry.complete('command-1', 'session-1'),
        ).toBe('completed');
    });

    it('expires commands after their timeout', () => {
        registry.register(
            makeCommand({
                createdAt: 1000,
            }),
        );

        expect(registry.expire(1999, 1000)).toEqual([]);
        expect(registry.find('command-1')).not.toBeNull();

        expect(registry.expire(2000, 1000)).toEqual([
            makeCommand({
                createdAt: 1000,
            }),
        ]);

        expect(registry.find('command-1')).toBeNull();
    });

    it('does not expire newer commands', () => {
        registry.register(
            makeCommand({
                commandId: 'old-command',
                createdAt: 1000,
            }),
        );

        registry.register(
            makeCommand({
                commandId: 'new-command',
                createdAt: 1800,
            }),
        );

        const expired = registry.expire(2000, 1000);

        expect(expired).toHaveLength(1);
        expect(expired[0].commandId).toBe('old-command');

        expect(registry.find('new-command')).not.toBeNull();
    });

    it('rejects invalid timeout arguments', () => {
        registry.register(makeCommand());

        expect(registry.expire(2000, 0)).toEqual([]);
        expect(registry.expire(NaN, 1000)).toEqual([]);
        expect(registry.expire(2000, -1)).toEqual([]);

        expect(registry.find('command-1')).not.toBeNull();
    });

    it('expires accepted commands without assuming execution stopped', () => {
        registry.register(makeCommand());

        expect(
            registry.accept('command-1', 'session-1'),
        ).toBe('accepted');

        expect(registry.expire(2000, 1000)).toEqual([
            makeCommand(),
        ]);
    });

});

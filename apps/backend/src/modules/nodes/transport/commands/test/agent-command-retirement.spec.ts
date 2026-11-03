import { AgentCommandRetirement } from '../agent-command-retirement';
import { AgentCommandsService } from '../agent-commands.service';
import { AgentPendingCommands } from '../agent-pending-commands';

const NOW = 1_000_000;

function createFixture(withDurableTracking = true) {
    const pendingCommands = new AgentPendingCommands();

    const markUnknown = jest.fn().mockResolvedValue(true);

    const agentCommandsService = withDurableTracking
        ? ({
            markUnknown,
        } as unknown as AgentCommandsService)
        : undefined;

    const retirement = new AgentCommandRetirement(
        pendingCommands,
        agentCommandsService,
    );

    return {
        pendingCommands,
        markUnknown,
        retirement,
    };
}

function registerCommand(
    pendingCommands: AgentPendingCommands,
    commandId: string,
    sessionId: string,
): void {
    const registered = pendingCommands.register({
        commandId,
        nodeId: 'node-1',
        serviceId: 'service-1',
        operation: 'start',
        sessionId,
        createdAt: NOW,
    });

    expect(registered).toBe(true);
}

describe('AgentCommandRetirement', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('marks retired commands UNKNOWN', () => {
        const fixture = createFixture();

        registerCommand(
            fixture.pendingCommands,
            'command-1',
            'session-1',
        );

        const commands =
            fixture.pendingCommands.drainSession('session-1');

        fixture.retirement.retireCommands(commands);

        expect(fixture.markUnknown).toHaveBeenCalledTimes(1);
        expect(fixture.markUnknown).toHaveBeenCalledWith(
            'command-1',
        );
    });

    it('retires only commands belonging to the disconnected session', () => {
        const fixture = createFixture();

        registerCommand(
            fixture.pendingCommands,
            'command-1',
            'session-1',
        );

        registerCommand(
            fixture.pendingCommands,
            'command-2',
            'session-1',
        );

        registerCommand(
            fixture.pendingCommands,
            'command-3',
            'session-2',
        );

        fixture.retirement.retireSessionCommands('session-1');

        expect(fixture.markUnknown).toHaveBeenCalledTimes(2);
        expect(fixture.markUnknown).toHaveBeenCalledWith(
            'command-1',
        );
        expect(fixture.markUnknown).toHaveBeenCalledWith(
            'command-2',
        );
        expect(fixture.markUnknown).not.toHaveBeenCalledWith(
            'command-3',
        );

        expect(
            fixture.pendingCommands.find('command-1'),
        ).toBeNull();

        expect(
            fixture.pendingCommands.find('command-2'),
        ).toBeNull();

        expect(
            fixture.pendingCommands.find('command-3'),
        ).not.toBeNull();
    });

    it('does not repeat retirement after a session is drained', () => {
        const fixture = createFixture();

        registerCommand(
            fixture.pendingCommands,
            'command-1',
            'session-1',
        );

        fixture.retirement.retireSessionCommands('session-1');
        fixture.retirement.retireSessionCommands('session-1');

        expect(fixture.markUnknown).toHaveBeenCalledTimes(1);
    });

    it('handles retirement of a session without commands', () => {
        const fixture = createFixture();

        expect(() => {
            fixture.retirement.retireSessionCommands(
                'empty-session',
            );
        }).not.toThrow();

        expect(fixture.markUnknown).not.toHaveBeenCalled();
    });

    it('drains commands without durable tracking', () => {
        const fixture = createFixture(false);

        registerCommand(
            fixture.pendingCommands,
            'command-1',
            'session-1',
        );

        fixture.retirement.retireSessionCommands('session-1');

        expect(
            fixture.pendingCommands.find('command-1'),
        ).toBeNull();

        expect(fixture.markUnknown).not.toHaveBeenCalled();
    });

    it('ignores an empty command list', () => {
        const fixture = createFixture();

        fixture.retirement.retireCommands([]);

        expect(fixture.markUnknown).not.toHaveBeenCalled();
    });

    it('handles a rejected database transition', async () => {
        const fixture = createFixture();
        const error = new Error('database unavailable');

        fixture.markUnknown.mockRejectedValue(error);

        registerCommand(
            fixture.pendingCommands,
            'command-1',
            'session-1',
        );

        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        expect(() => {
            fixture.retirement.retireSessionCommands(
                'session-1',
            );
        }).not.toThrow();

        await Promise.resolve();
        await Promise.resolve();

        expect(consoleSpy).toHaveBeenCalledWith(
            'Failed to mark Agent command UNKNOWN',
            {
                commandId: 'command-1',
                error,
            },
        );

        expect(
            fixture.pendingCommands.find('command-1'),
        ).toBeNull();
    });

    it('does not treat a conditional database rejection as an exception', async () => {
        const fixture = createFixture();

        fixture.markUnknown.mockResolvedValue(false);

        registerCommand(
            fixture.pendingCommands,
            'command-1',
            'session-1',
        );

        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        fixture.retirement.retireSessionCommands('session-1');

        await Promise.resolve();

        expect(fixture.markUnknown).toHaveBeenCalledWith(
            'command-1',
        );

        expect(consoleSpy).not.toHaveBeenCalled();
    });
});
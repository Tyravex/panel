import {
    AGENT_OPERATIONS,
    isValidAgentMessage,
    isValidAgentPayload,
} from '../agent-payload';
import { createAgentEnvelope } from '../agent-protocol';

const SERVICE_ID = 'service-test-1';
const NODE_ID = 'node-test-1';

function validInstallParameters() {
    return {
        formatVersion: 1,
        serviceId: SERVICE_ID,
        jobId: 'job-test-1',
        nodeId: NODE_ID,
        egg: {
            id: 'egg-test-1',
            key: 'nodejs-discord-bot',
            version: '1.0.0',
        },
        runtime: {
            image: 'node:22-bookworm-slim',
            startup: 'node index.js',
        },
        resources: {
            memoryMb: 512,
            cpuPercent: 10,
            diskMb: 512,
        },
        variables: [
            {
                key: 'BOT_TOKEN',
                required: true,
            },
        ],
    };
}

function validInstallCommand() {
    return {
        commandId: 'command-test-1',
        operation: 'service.install',
        serviceId: SERVICE_ID,
        parameters: validInstallParameters(),
    };
}

describe('Agent Service command protocol', () => {
    it('defines only Service operations', () => {
        expect(AGENT_OPERATIONS).toEqual([
            'service.install',
            'service.start',
            'service.stop',
            'service.restart',
        ]);

        expect(AGENT_OPERATIONS).not.toContain(
            'server.start' as never,
        );
    });

    it('accepts a valid service.install command', () => {
        expect(
            isValidAgentPayload(
                'command.execute',
                validInstallCommand(),
            ),
        ).toBe(true);
    });

    it('accepts a valid command inside an envelope', () => {
        const envelope = createAgentEnvelope(
            'command.execute',
            validInstallCommand(),
            'message-test-1',
        );

        expect(isValidAgentMessage(envelope)).toBe(true);
    });

    it('rejects a mismatched serviceId', () => {
        const command = validInstallCommand();

        command.parameters.serviceId = 'different-service';

        expect(
            isValidAgentPayload('command.execute', command),
        ).toBe(false);
    });

    it('rejects the legacy serverId field', () => {
        const command = {
            ...validInstallCommand(),
            serverId: 'legacy-server',
        };

        expect(
            isValidAgentPayload('command.execute', command),
        ).toBe(false);
    });

    it.each([
        'server.start',
        'server.stop',
        'server.restart',
        'server.install',
    ])('rejects legacy operation %s', (operation) => {
        expect(
            isValidAgentPayload('command.execute', {
                commandId: 'command-test-1',
                operation,
                serviceId: SERVICE_ID,
                parameters: {},
            }),
        ).toBe(false);
    });

    it.each([
        'service.start',
        'service.stop',
        'service.restart',
    ])('accepts %s with empty parameters', (operation) => {
        expect(
            isValidAgentPayload('command.execute', {
                commandId: 'command-test-1',
                operation,
                serviceId: SERVICE_ID,
                parameters: {},
            }),
        ).toBe(true);
    });

    it('rejects nonempty parameters for service.start', () => {
        expect(
            isValidAgentPayload('command.execute', {
                commandId: 'command-test-1',
                operation: 'service.start',
                serviceId: SERVICE_ID,
                parameters: {
                    command: 'rm -rf /',
                },
            }),
        ).toBe(false);
    });

    it('rejects additional command fields', () => {
        expect(
            isValidAgentPayload('command.execute', {
                ...validInstallCommand(),
                shellCommand: 'echo unexpected',
            }),
        ).toBe(false);
    });

    it('rejects a secret value in installation variables', () => {
        const command = validInstallCommand();

        expect(
            isValidAgentPayload('command.execute', {
                ...command,
                parameters: {
                    ...command.parameters,
                    variables: [
                        {
                            key: 'BOT_TOKEN',
                            required: true,
                            value: 'should-not-be-transmitted',
                        },
                    ],
                },
            }),
        ).toBe(false);
    });

    it('rejects unsupported install format versions', () => {
        const command = validInstallCommand();

        command.parameters.formatVersion = 2;

        expect(
            isValidAgentPayload('command.execute', command),
        ).toBe(false);
    });

    it('rejects missing installation parameters', () => {
        expect(
            isValidAgentPayload('command.execute', {
                commandId: 'command-test-1',
                operation: 'service.install',
                serviceId: SERVICE_ID,
                parameters: {},
            }),
        ).toBe(false);
    });

    it('rejects empty command and service identifiers', () => {
        expect(
            isValidAgentPayload('command.execute', {
                ...validInstallCommand(),
                commandId: ' ',
            }),
        ).toBe(false);

        expect(
            isValidAgentPayload('command.execute', {
                ...validInstallCommand(),
                serviceId: '',
            }),
        ).toBe(false);
    });

    it('does not change heartbeat ACK validation', () => {
        expect(
            isValidAgentPayload('node.heartbeat.ack', {}),
        ).toBe(true);

        expect(
            isValidAgentPayload('node.heartbeat.ack', {
                unexpected: true,
            }),
        ).toBe(false);
    });
});

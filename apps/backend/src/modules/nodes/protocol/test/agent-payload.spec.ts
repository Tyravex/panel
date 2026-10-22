
import {
    isValidAgentMessage,
    isValidAgentPayload,
} from '../agent-payload';

describe('Agent protocol payload validation', () => {
    it('accepts valid hello payload', () => {
        expect(
            isValidAgentPayload('node.hello', {
                agentVersion: '0.4.0',
                capabilities: ['docker'],
            }),
        ).toBe(true);
    });

    it('rejects invalid hello capabilities', () => {
        expect(
            isValidAgentPayload('node.hello', {
                agentVersion: '0.4.0',
                capabilities: [123],
            }),
        ).toBe(false);
    });

    it('accepts valid heartbeat', () => {
        expect(
            isValidAgentPayload('node.heartbeat', {
                uptimeSeconds: 3600,
                docker: {
                    available: true,
                    version: '29.2.1',
                },
            }),
        ).toBe(true);
    });

    it('rejects negative uptime', () => {
        expect(
            isValidAgentPayload('node.heartbeat', {
                uptimeSeconds: -1,
                docker: {
                    available: true,
                    version: '29.2.1',
                },
            }),
        ).toBe(false);
    });

    it('rejects malformed Docker information', () => {
        expect(
            isValidAgentPayload('node.heartbeat', {
                uptimeSeconds: 10,
                docker: {
                    available: 'yes',
                    version: null,
                },
            }),
        ).toBe(false);
    });

    it('accepts a known command', () => {
        expect(
            isValidAgentPayload('command.execute', {
                commandId: 'command-1',
                operation: 'server.start',
                serverId: 'server-1',
                parameters: {},
            }),
        ).toBe(true);
    });

    it('rejects unknown commands', () => {
        expect(
            isValidAgentPayload('command.execute', {
                commandId: 'command-1',
                operation: 'system.execute',
                serverId: 'server-1',
                parameters: {},
            }),
        ).toBe(false);
    });

    it('rejects unexpected command parameters', () => {
        expect(
            isValidAgentPayload('command.execute', {
                commandId: 'command-1',
                operation: 'server.start',
                serverId: 'server-1',
                parameters: {
                    shell: 'powershell',
                },
            }),
        ).toBe(false);
    });

    it('accepts command result', () => {
        expect(
            isValidAgentPayload('command.result', {
                commandId: 'command-1',
                success: true,
            }),
        ).toBe(true);
    });

    it('rejects unknown payload fields', () => {
        expect(
            isValidAgentPayload('node.hello', {
                agentVersion: '0.4.0',
                capabilities: [],
                secret: 'unexpected',
            }),
        ).toBe(false);
    });

    it('validates complete messages', () => {
        expect(
            isValidAgentMessage({
                protocol: 1,
                id: 'message-1',
                type: 'node.hello',
                timestamp: '2026-10-21T12:00:00Z',
                payload: {
                    agentVersion: '0.4.0',
                    capabilities: ['docker'],
                },
            }),
        ).toBe(true);
    });

    it('rejects valid envelopes with invalid payloads', () => {
        expect(
            isValidAgentMessage({
                protocol: 1,
                id: 'message-1',
                type: 'node.hello',
                timestamp: '2026-10-21T12:00:00Z',
                payload: {
                    agentVersion: '',
                    capabilities: [],
                },
            }),
        ).toBe(false);
    });
});

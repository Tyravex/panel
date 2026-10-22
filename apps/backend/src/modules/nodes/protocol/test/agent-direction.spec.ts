
import {
    AGENT_TO_PANEL_TYPES,
    PANEL_TO_AGENT_TYPES,
    isAgentToPanelMessage,
    isPanelToAgentMessage,
} from '../agent-direction';

import {
    AGENT_MESSAGE_TYPES,
    createAgentEnvelope,
} from '../agent-protocol';

describe('Agent protocol message direction', () => {
    const hello = createAgentEnvelope(
        'node.hello',
        {
            agentVersion: '0.4.0',
            capabilities: ['docker'],
        },
        'hello-1',
    );

    const welcome = createAgentEnvelope(
        'node.welcome',
        {
            nodeId: 'node-1',
            heartbeatIntervalSeconds: 30,
        },
        'welcome-1',
    );

    const heartbeat = createAgentEnvelope(
        'node.heartbeat',
        {
            uptimeSeconds: 100,
            docker: {
                available: true,
                version: '29.2.1',
            },
        },
        'heartbeat-1',
    );

    const command = createAgentEnvelope(
        'command.execute',
        {
            commandId: 'command-1',
            operation: 'server.start',
            serverId: 'server-1',
            parameters: {},
        },
        'command-message-1',
    );

    const protocolError = createAgentEnvelope(
        'protocol.error',
        {
            code: 'INVALID_MESSAGE',
            message: 'Invalid message',
        },
        'error-1',
    );

    it('accepts hello from Agent', () => {
        expect(isAgentToPanelMessage(hello)).toBe(true);
    });

    it('rejects hello from Panel', () => {
        expect(isPanelToAgentMessage(hello)).toBe(false);
    });

    it('accepts welcome from Panel', () => {
        expect(isPanelToAgentMessage(welcome)).toBe(true);
    });

    it('rejects welcome from Agent', () => {
        expect(isAgentToPanelMessage(welcome)).toBe(false);
    });

    it('accepts heartbeat from Agent', () => {
        expect(isAgentToPanelMessage(heartbeat)).toBe(true);
    });

    it('rejects commands sent by Agent', () => {
        expect(isAgentToPanelMessage(command)).toBe(false);
    });

    it('accepts commands sent by Panel', () => {
        expect(isPanelToAgentMessage(command)).toBe(true);
    });

    it('accepts protocol errors in both directions', () => {
        expect(isAgentToPanelMessage(protocolError)).toBe(true);
        expect(isPanelToAgentMessage(protocolError)).toBe(true);
    });

    it('rejects invalid payloads regardless of direction', () => {
        const invalid = {
            ...hello,
            payload: {
                agentVersion: '',
                capabilities: [],
            },
        };

        expect(isAgentToPanelMessage(invalid)).toBe(false);
        expect(isPanelToAgentMessage(invalid)).toBe(false);
    });

    it('rejects unsupported protocol versions', () => {
        const invalid = {
            ...hello,
            protocol: 2,
        };

        expect(isAgentToPanelMessage(invalid)).toBe(false);
        expect(isPanelToAgentMessage(invalid)).toBe(false);
    });

    it('assigns every known message type a direction', () => {
        const assignedTypes = new Set([
            ...AGENT_TO_PANEL_TYPES,
            ...PANEL_TO_AGENT_TYPES,
        ]);

        expect(
            [...AGENT_MESSAGE_TYPES].every((type) =>
                assignedTypes.has(type),
            ),
        ).toBe(true);
    });

    it('does not permit commands from Agent to Panel', () => {
        expect(AGENT_TO_PANEL_TYPES).not.toContain(
            'command.execute',
        );
    });
});

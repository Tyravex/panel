
export const AGENT_PROTOCOL_VERSION = 1 as const;

export const AGENT_MESSAGE_TYPES = [
    'node.hello',
    'node.welcome',
    'node.heartbeat',
    'node.heartbeat.ack',
    'command.execute',
    'command.accepted',
    'command.result',
    'protocol.error',
] as const;

export type AgentMessageType =
    (typeof AGENT_MESSAGE_TYPES)[number];

export interface AgentEnvelope {
    protocol: typeof AGENT_PROTOCOL_VERSION;
    id: string;
    type: AgentMessageType;
    timestamp: string;
    payload: Record<string, unknown>;
}

export interface AgentHelloPayload {
    agentVersion: string;
    capabilities: string[];
}

export interface AgentWelcomePayload {
    nodeId: string;
    heartbeatIntervalSeconds: number;
}

export interface AgentHeartbeatPayload {
    uptimeSeconds: number;
    docker: {
        available: boolean;
        version: string | null;
    };
}

export interface AgentCommandPayload {
    commandId: string;
    operation: string;
    serverId: string;
    parameters: Record<string, unknown>;
}

export interface AgentCommandAcceptedPayload {
    commandId: string;
}

export interface AgentCommandResultPayload {
    commandId: string;
    success: boolean;
    errorCode?: string;
    message?: string;
    result?: Record<string, unknown>;
}

export interface AgentProtocolErrorPayload {
    code: string;
    message: string;
    requestId?: string;
}

const MESSAGE_TYPE_SET = new Set<string>(
    AGENT_MESSAGE_TYPES,
);

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    );
}

export function isAgentEnvelope(
    value: unknown,
): value is AgentEnvelope {
    if (!isRecord(value)) {
        return false;
    }

    if (value.protocol !== AGENT_PROTOCOL_VERSION) {
        return false;
    }

    if (
        typeof value.id !== 'string' ||
        value.id.length < 1 ||
        value.id.length > 128
    ) {
        return false;
    }

    if (
        typeof value.type !== 'string' ||
        !MESSAGE_TYPE_SET.has(value.type)
    ) {
        return false;
    }

    if (
        typeof value.timestamp !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(
            value.timestamp,
        ) ||
        !Number.isFinite(Date.parse(value.timestamp))
    ) {
        return false;
    }

    return isRecord(value.payload);
}

export function createAgentEnvelope(
    type: AgentMessageType,
    payload: Record<string, unknown>,
    id: string,
): AgentEnvelope {
    if (
        typeof id !== 'string' ||
        id.length < 1 ||
        id.length > 128
    ) {
        throw new Error('Invalid agent message ID');
    }

    if (!MESSAGE_TYPE_SET.has(type)) {
        throw new Error('Unsupported agent message type');
    }

    if (!isRecord(payload)) {
        throw new Error('Invalid agent message payload');
    }

    return {
        protocol: AGENT_PROTOCOL_VERSION,
        id,
        type,
        timestamp: new Date().toISOString(),
        payload,
    };
}

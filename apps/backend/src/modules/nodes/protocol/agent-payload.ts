
import {
    AgentEnvelope,
    AgentMessageType,
    isAgentEnvelope,
} from './agent-protocol';

export const AGENT_OPERATIONS = [
    'server.start',
    'server.stop',
    'server.restart',
] as const;

export type AgentOperation =
    (typeof AGENT_OPERATIONS)[number];

const OPERATIONS = new Set<string>(AGENT_OPERATIONS);

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    );
}

function isNonEmptyString(
    value: unknown,
    maxLength = 128,
): value is string {
    return (
        typeof value === 'string' &&
        value.trim().length > 0 &&
        value.length <= maxLength
    );
}

function hasOnlyKeys(
    value: Record<string, unknown>,
    allowed: readonly string[],
): boolean {
    return Object.keys(value).every((key) =>
        allowed.includes(key),
    );
}

function isStringArray(
    value: unknown,
): value is string[] {
    return (
        Array.isArray(value) &&
        value.length <= 64 &&
        value.every((item) => isNonEmptyString(item, 128))
    );
}

export function isValidAgentPayload(
    type: AgentMessageType,
    payload: unknown,
): boolean {
    if (!isRecord(payload)) {
        return false;
    }

    switch (type) {
        case 'node.hello':
            return (
                hasOnlyKeys(payload, [
                    'agentVersion',
                    'capabilities',
                ]) &&
                isNonEmptyString(payload.agentVersion, 64) &&
                isStringArray(payload.capabilities)
            );

        case 'node.welcome':
            return (
                hasOnlyKeys(payload, [
                    'nodeId',
                    'heartbeatIntervalSeconds',
                ]) &&
                isNonEmptyString(payload.nodeId) &&
                Number.isInteger(payload.heartbeatIntervalSeconds) &&
                typeof payload.heartbeatIntervalSeconds === 'number' &&
                payload.heartbeatIntervalSeconds >= 5 &&
                payload.heartbeatIntervalSeconds <= 300
            );

        case 'node.heartbeat': {
            if (
                !hasOnlyKeys(payload, [
                    'uptimeSeconds',
                    'docker',
                ]) ||
                typeof payload.uptimeSeconds !== 'number' ||
                !Number.isSafeInteger(payload.uptimeSeconds) ||
                payload.uptimeSeconds < 0 ||
                !isRecord(payload.docker)
            ) {
                return false;
            }

            const docker = payload.docker;

            return (
                hasOnlyKeys(docker, [
                    'available',
                    'version',
                ]) &&
                typeof docker.available === 'boolean' &&
                (docker.version === null ||
                    isNonEmptyString(docker.version, 128))
            );
        }

        case 'node.heartbeat.ack':
            return Object.keys(payload).length === 0;

        case 'command.execute':
            return (
                hasOnlyKeys(payload, [
                    'commandId',
                    'operation',
                    'serverId',
                    'parameters',
                ]) &&
                isNonEmptyString(payload.commandId) &&
                typeof payload.operation === 'string' &&
                OPERATIONS.has(payload.operation) &&
                isNonEmptyString(payload.serverId) &&
                isRecord(payload.parameters) &&
                Object.keys(payload.parameters).length === 0
            );

        case 'command.accepted':
            return (
                hasOnlyKeys(payload, ['commandId']) &&
                isNonEmptyString(payload.commandId)
            );

        case 'command.result':
            return (
                hasOnlyKeys(payload, [
                    'commandId',
                    'success',
                    'errorCode',
                    'message',
                    'result',
                ]) &&
                isNonEmptyString(payload.commandId) &&
                typeof payload.success === 'boolean' &&
                (payload.errorCode === undefined ||
                    isNonEmptyString(payload.errorCode, 128)) &&
                (payload.message === undefined ||
                    (typeof payload.message === 'string' &&
                        payload.message.length <= 1024)) &&
                (payload.result === undefined ||
                    isRecord(payload.result))
            );

        case 'protocol.error':
            return (
                hasOnlyKeys(payload, [
                    'code',
                    'message',
                    'requestId',
                ]) &&
                isNonEmptyString(payload.code, 128) &&
                isNonEmptyString(payload.message, 1024) &&
                (payload.requestId === undefined ||
                    isNonEmptyString(payload.requestId))
            );

        default:
            return false;
    }
}

export function isValidAgentMessage(
    value: unknown,
): value is AgentEnvelope {
    return (
        isAgentEnvelope(value) &&
        isValidAgentPayload(value.type, value.payload)
    );
}

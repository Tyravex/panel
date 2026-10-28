import { randomBytes, randomUUID } from 'node:crypto';

export const PROTOCOL_VERSION = 1;
export const MAX_OWNERSHIP_ASSIGNMENTS = 4096;
export const MAX_OWNERSHIP_TTL_SECONDS = 300;
export const MAX_OWNERSHIP_PAYLOAD_BYTES = 1024 * 1024;
export const MAX_OWNERSHIP_ENVELOPE_BYTES = MAX_OWNERSHIP_PAYLOAD_BYTES + 4096;

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const SERVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export interface OwnershipAssignment {
    service_id: string;
    node_id: string;
    enabled: boolean;
}

export interface OwnershipSnapshot {
    type: 'ownership.snapshot';
    session_id: string;
    node_id: string;
    revision: number;
    ttl_seconds: number;
    assignments: OwnershipAssignment[];
}

export interface NodeWelcome {
    nodeId: string;
    heartbeatIntervalSeconds: number;
    sessionId: string;
}

export interface ProtocolEnvelope<T> {
    protocol: 1;
    id: string;
    type: string;
    timestamp: string;
    payload: T;
}

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
    return (
        Object.keys(value).length === keys.length &&
        keys.every((key) =>
            Object.prototype.hasOwnProperty.call(value, key),
        )
    );
}

export function validSessionId(value: unknown): value is string {
    return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}

export function validServiceId(value: unknown): value is string {
    return typeof value === 'string' && SERVICE_ID_PATTERN.test(value);
}

export function createSessionId(): string {
    return randomBytes(32).toString('hex');
}

export function validateNodeWelcome(value: unknown): asserts value is NodeWelcome {
    if (!record(value) || !exactKeys(value, ['nodeId', 'heartbeatIntervalSeconds', 'sessionId']) ||
        typeof value.nodeId !== 'string' || value.nodeId.length === 0 ||
        !Number.isInteger(value.heartbeatIntervalSeconds) ||
        (value.heartbeatIntervalSeconds as number) < 5 ||
        (value.heartbeatIntervalSeconds as number) > 300 ||
        !validSessionId(value.sessionId)) {
        throw new Error('Invalid node.welcome payload');
    }
}

export function validateOwnershipSnapshot(value: unknown, expectedNodeId: string, expectedSessionId: string): asserts value is OwnershipSnapshot {
    if (!record(value) || !exactKeys(value, ['type', 'session_id', 'node_id', 'revision', 'ttl_seconds', 'assignments']) ||
        value.type !== 'ownership.snapshot' || value.session_id !== expectedSessionId ||
        !validSessionId(value.session_id) || value.node_id !== expectedNodeId ||
        typeof value.node_id !== 'string' || value.node_id.length === 0 ||
        !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 ||
        !Number.isInteger(value.ttl_seconds) || (value.ttl_seconds as number) < 1 ||
        (value.ttl_seconds as number) > MAX_OWNERSHIP_TTL_SECONDS ||
        !Array.isArray(value.assignments) || value.assignments.length > MAX_OWNERSHIP_ASSIGNMENTS) {
        throw new Error('Invalid ownership.snapshot payload');
    }

    const seen = new Set<string>();
    for (const assignment of value.assignments) {
        if (!record(assignment) || !exactKeys(assignment, ['service_id', 'node_id', 'enabled']) ||
            !validServiceId(assignment.service_id) || assignment.node_id !== expectedNodeId ||
            typeof assignment.enabled !== 'boolean' || seen.has(assignment.service_id)) {
            throw new Error('Invalid ownership assignment');
        }
        seen.add(assignment.service_id);
    }

    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_OWNERSHIP_PAYLOAD_BYTES) {
        throw new Error('Ownership snapshot payload too large');
    }
}

export function createEnvelope<T>(type: string, payload: T): ProtocolEnvelope<T> {
    return {
        protocol: 1,
        id: randomUUID().replaceAll('-', ''),
        type,
        timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        payload,
    };
}

export function serializeOwnershipSnapshot(snapshot: OwnershipSnapshot): string {
    const message = JSON.stringify(createEnvelope('ownership.snapshot', snapshot));
    if (Buffer.byteLength(message, 'utf8') > MAX_OWNERSHIP_ENVELOPE_BYTES) {
        throw new Error('Ownership snapshot envelope too large');
    }
    return message;
}

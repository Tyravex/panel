import {
    createSessionId,
    validateNodeWelcome,
    validateOwnershipSnapshot,
    validServiceId,
    validSessionId,
    serializeOwnershipSnapshot,
    type OwnershipSnapshot,
} from '../ownership-contract';

const nodeId = 'node-1';
const sessionId = 'session-0000000000000001';
const snapshot = (): OwnershipSnapshot => ({
    type: 'ownership.snapshot',
    session_id: sessionId,
    node_id: nodeId,
    revision: 1,
    ttl_seconds: 60,
    assignments: [{ service_id: 'minecraft-survival', node_id: nodeId, enabled: true }],
});

describe('Panel ↔ Agent ownership contract', () => {
    it('generates transport-valid random session IDs', () => {
        const a = createSessionId();
        const b = createSessionId();
        expect(validSessionId(a)).toBe(true);
        expect(a).not.toBe(b);
    });

    it('validates welcome', () => {
        expect(() => validateNodeWelcome({ nodeId, sessionId, heartbeatIntervalSeconds: 30 })).not.toThrow();
        expect(() => validateNodeWelcome({ nodeId, sessionId: 'short', heartbeatIntervalSeconds: 30 })).toThrow();
    });

    it('validates snapshot and serializes envelope', () => {
        const value = snapshot();
        expect(() => validateOwnershipSnapshot(value, nodeId, sessionId)).not.toThrow();
        expect(JSON.parse(serializeOwnershipSnapshot(value)).type).toBe('ownership.snapshot');
    });

    it('rejects mismatched session and duplicate services', () => {
        expect(() => validateOwnershipSnapshot(snapshot(), nodeId, 'session-0000000000000002')).toThrow();
        const duplicate = snapshot();
        duplicate.assignments.push({ ...duplicate.assignments[0] });
        expect(() => validateOwnershipSnapshot(duplicate, nodeId, sessionId)).toThrow();
    });

    it('enforces service ID and TTL restrictions', () => {
        expect(validServiceId('minecraft_survival-1')).toBe(true);
        expect(validServiceId('_minecraft')).toBe(false);
        const invalid = snapshot();
        invalid.ttl_seconds = 301;
        expect(() => validateOwnershipSnapshot(invalid, nodeId, sessionId)).toThrow();
    });
});

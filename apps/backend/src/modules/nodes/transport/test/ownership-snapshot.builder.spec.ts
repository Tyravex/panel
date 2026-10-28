import { NodesService } from '../../nodes.service';
import { OwnershipSnapshotBuilder } from '../ownership-snapshot.builder';
import {
    serializeOwnershipSnapshot,
    validateOwnershipSnapshot,
} from '../../protocol/ownership-contract';

describe('OwnershipSnapshotBuilder', () => {
    const findAssignedServiceIds = jest.fn();

    const nodeId = 'node-1';
    const sessionId = 'a'.repeat(32);

    let builder: OwnershipSnapshotBuilder;

    beforeEach(() => {
        jest.clearAllMocks();

        builder = new OwnershipSnapshotBuilder({
            findAssignedServiceIds,
        } as unknown as NodesService);
    });

    it('builds a valid snapshot from database assignments', async () => {
        findAssignedServiceIds.mockResolvedValue([
            'service-1',
            'service-2',
        ]);

        const snapshot = await builder.build(
            nodeId,
            sessionId,
            1,
        );

        expect(snapshot).toEqual({
            type: 'ownership.snapshot',
            session_id: sessionId,
            node_id: nodeId,
            revision: 1,
            ttl_seconds: 60,
            assignments: [
                {
                    service_id: 'service-1',
                    node_id: nodeId,
                    enabled: true,
                },
                {
                    service_id: 'service-2',
                    node_id: nodeId,
                    enabled: true,
                },
            ],
        });

        expect(findAssignedServiceIds).toHaveBeenCalledWith(nodeId);

        expect(() =>
            validateOwnershipSnapshot(
                snapshot,
                nodeId,
                sessionId,
            ),
        ).not.toThrow();

        expect(() =>
            serializeOwnershipSnapshot(snapshot),
        ).not.toThrow();
    });

    it('builds an empty snapshot for a node without assignments', async () => {
        findAssignedServiceIds.mockResolvedValue([]);

        const snapshot = await builder.build(
            nodeId,
            sessionId,
            1,
        );

        expect(snapshot.assignments).toEqual([]);
    });

    it('rejects more than 4096 assignments', async () => {
        findAssignedServiceIds.mockResolvedValue(
            Array.from(
                { length: 4097 },
                (_, index) => `service-${index + 1}`,
            ),
        );

        await expect(
            builder.build(nodeId, sessionId, 1),
        ).rejects.toThrow('Ownership assignment limit exceeded');
    });

    it('rejects an invalid service ID', async () => {
        findAssignedServiceIds.mockResolvedValue([
            'invalid.service.id',
        ]);

        await expect(
            builder.build(nodeId, sessionId, 1),
        ).rejects.toThrow(
            'Invalid service ID in ownership assignments',
        );
    });

    it('rejects duplicate assignments', async () => {
        findAssignedServiceIds.mockResolvedValue([
            'service-1',
            'service-1',
        ]);

        await expect(
            builder.build(nodeId, sessionId, 1),
        ).rejects.toThrow('Duplicate ownership assignment');
    });

    it('rejects an invalid session ID before querying the database', async () => {
        await expect(
            builder.build(nodeId, 'invalid', 1),
        ).rejects.toThrow('Invalid ownership snapshot context');

        expect(findAssignedServiceIds).not.toHaveBeenCalled();
    });

    it('rejects an invalid revision before querying the database', async () => {
        await expect(
            builder.build(nodeId, sessionId, 0),
        ).rejects.toThrow('Invalid ownership snapshot context');

        expect(findAssignedServiceIds).not.toHaveBeenCalled();
    });

    it('propagates database failures instead of granting empty ownership', async () => {
        findAssignedServiceIds.mockRejectedValue(
            new Error('Database unavailable'),
        );

        await expect(
            builder.build(nodeId, sessionId, 1),
        ).rejects.toThrow('Database unavailable');
    });
});

import { NodesService } from '../nodes.service';
import {
    MAX_OWNERSHIP_ASSIGNMENTS,
    OwnershipSnapshot,
    serializeOwnershipSnapshot,
    validateOwnershipSnapshot,
    validServiceId,
    validSessionId,
} from '../protocol/ownership-contract';

export class OwnershipSnapshotBuilder {
    constructor(
        private readonly nodesService: NodesService,
    ) { }

    async build(
        nodeId: string,
        sessionId: string,
        revision: number,
        ttlSeconds = 60,
    ): Promise<OwnershipSnapshot> {
        if (
            typeof nodeId !== 'string' ||
            nodeId.length === 0 ||
            !validSessionId(sessionId) ||
            !Number.isSafeInteger(revision) ||
            revision < 1
        ) {
            throw new Error('Invalid ownership snapshot context');
        }

        const serviceIds =
            await this.nodesService.findAssignedServiceIds(nodeId);

        // Reject oversized results instead of silently truncating rights.
        if (serviceIds.length > MAX_OWNERSHIP_ASSIGNMENTS) {
            throw new Error('Ownership assignment limit exceeded');
        }

        // Database records must satisfy the Agent's service ID contract.
        // Never silently omit an invalid assignment.
        if (serviceIds.some((id) => !validServiceId(id))) {
            throw new Error('Invalid service ID in ownership assignments');
        }

        // Reject duplicates even if the current database query is unique.
        if (new Set(serviceIds).size !== serviceIds.length) {
            throw new Error('Duplicate ownership assignment');
        }

        const snapshot: OwnershipSnapshot = {
            type: 'ownership.snapshot',
            session_id: sessionId,
            node_id: nodeId,
            revision,
            ttl_seconds: ttlSeconds,
            assignments: serviceIds.map((serviceId) => ({
                service_id: serviceId,
                node_id: nodeId,
                enabled: true,
            })),
        };

        validateOwnershipSnapshot(
            snapshot,
            nodeId,
            sessionId,
        );

        // Check the serialized envelope before any WebSocket send.
        serializeOwnershipSnapshot(snapshot);

        return snapshot;
    }
}

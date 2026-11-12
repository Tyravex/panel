import { api } from '@/shared/api/client';

export type NodeStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';

export interface NodeRecord {
    id: string;
    name: string;
    status: NodeStatus;
    regionId: string | null;
    locationId: string | null;
    manualAllocationEnabled: boolean;
    automaticAllocationEnabled: boolean;
    lastSeenAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface UpdateNodeRequest {
    name?: string;
    regionId?: string | null;
    locationId?: string | null;
    manualAllocationEnabled?: boolean;
    automaticAllocationEnabled?: boolean;
}
export interface NodeCredentials {
    id: string;
    name: string;
    token: string;
}

export const nodesApi = {
    async list(signal?: AbortSignal): Promise<NodeRecord[]> {
        const response = await api.get<NodeRecord[]>('/nodes', {
            signal,
        });

        return response.data;
    },

    async create(
        name: string,
        assignment?: {
            regionId?: string;
            locationId?: string;
            manualAllocationEnabled?: boolean;
            automaticAllocationEnabled?: boolean;
        },
    ): Promise<NodeCredentials> {
        const response = await api.post<NodeCredentials>(
            '/nodes',
            {
                name,
                ...(assignment?.regionId
                    ? { regionId: assignment.regionId }
                    : {}),
                ...(assignment?.locationId
                    ? { locationId: assignment.locationId }
                    : {}),
                ...(assignment?.manualAllocationEnabled !== undefined
                    ? { manualAllocationEnabled: assignment.manualAllocationEnabled }
                    : {}),
                ...(assignment?.automaticAllocationEnabled !== undefined
                    ? { automaticAllocationEnabled: assignment.automaticAllocationEnabled }
                    : {}),
            },
        );

        return response.data;
    },

    async getById(
        id: string,
        signal?: AbortSignal,
    ): Promise<NodeRecord> {
        const response = await api.get<NodeRecord>(
            `/nodes/${encodeURIComponent(id)}`,
            { signal },
        );

        return response.data;
    },

    async update(
        id: string,
        payload: UpdateNodeRequest,
    ): Promise<NodeRecord> {
        const response = await api.patch<NodeRecord>(
            `/nodes/${encodeURIComponent(id)}`,
            payload,
        );

        return response.data;
    },
    async delete(id: string): Promise<void> {
        await api.delete(`/nodes/${encodeURIComponent(id)}`);
    },

    async rotateToken(id: string): Promise<NodeCredentials> {
        const response = await api.post<NodeCredentials>(
            `/nodes/${encodeURIComponent(id)}/rotate-token`,
        );

        return response.data;
    },
};

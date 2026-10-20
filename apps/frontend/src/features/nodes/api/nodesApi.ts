import { api } from '@/shared/api/client';

export type NodeStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';

export interface NodeRecord {
    id: string;
    name: string;
    status: NodeStatus;
    lastSeenAt: string | null;
    createdAt: string;
    updatedAt: string;
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

    async create(name: string): Promise<NodeCredentials> {
        const response = await api.post<NodeCredentials>(
            '/nodes',
            { name },
        );

        return response.data;
    },

    async rotateToken(id: string): Promise<NodeCredentials> {
        const response = await api.post<NodeCredentials>(
            `/nodes/${encodeURIComponent(id)}/rotate-token`,
        );

        return response.data;
    },
};

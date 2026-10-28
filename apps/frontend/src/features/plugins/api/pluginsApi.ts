import { api } from '@/shared/api/client';

export type PluginType =
    | 'LANGUAGE'
    | 'THEME'
    | 'INTEGRATION'
    | 'BILLING'
    | 'NOTIFICATION'
    | 'OTHER';

export type PluginStatus =
    | 'INSTALLED'
    | 'DISABLED'
    | 'FAILED';

export interface PluginRecord {
    id: string;
    type: PluginType;
    version: string;
    status: PluginStatus;
    sourceRepository: string | null;
    installedAt: string;
    updatedAt: string;
}

export const pluginsApi = {
    async list(signal?: AbortSignal): Promise<PluginRecord[]> {
        const response = await api.get<PluginRecord[]>(
            '/admin/plugins',
            { signal },
        );

        return response.data;
    },

    async getById(
        id: string,
        signal?: AbortSignal,
    ): Promise<PluginRecord> {
        const response = await api.get<PluginRecord>(
            `/admin/plugins/${encodeURIComponent(id)}`,
            { signal },
        );

        return response.data;
    },
};
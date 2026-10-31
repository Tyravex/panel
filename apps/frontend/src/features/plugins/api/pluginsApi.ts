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
    | 'INSTALLING'
    | 'UPDATING'
    | 'UNINSTALLING'
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

export interface PluginInstallResult {
    id: string;
    type: 'LANGUAGE';
    version: string;
    status: 'INSTALLED';
}

export interface PluginUninstallResult {
    id: string;
    removed: boolean;
    cleanupPending: boolean;
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

    async install(file: File): Promise<PluginInstallResult> {
        const response = await api.post<PluginInstallResult>(
            '/admin/plugins/install',
            file,
            {
                headers: {
                    'Content-Type': 'application/zip',
                },
            },
        );

        return response.data;
    },

    async enable(id: string): Promise<PluginRecord> {
        const response = await api.post<PluginRecord>(
            `/admin/plugins/${encodeURIComponent(id)}/enable`,
        );

        return response.data;
    },

    async disable(id: string): Promise<PluginRecord> {
        const response = await api.post<PluginRecord>(
            `/admin/plugins/${encodeURIComponent(id)}/disable`,
        );

        return response.data;
    },

    async uninstall(
        id: string,
        confirmId: string,
    ): Promise<PluginUninstallResult> {
        const response = await api.delete<PluginUninstallResult>(
            `/admin/plugins/${encodeURIComponent(id)}`,
            {
                data: {
                    confirmId,
                },
            },
        );

        return response.data;
    },
};
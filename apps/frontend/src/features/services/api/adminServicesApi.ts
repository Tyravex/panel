import { api } from '@/shared/api/client';

export interface AdminService {
  id: string;
  name: string;
  userId: number | null;
  user: { id: number; username: string } | null;
  category: { key: string; name: string };
  nodeId: string | null;
  memoryMb: number | null;
  cpuPercent: number | null;
  diskMb: number | null;
  installStatus: string;
  createdAt: string;
}

export interface CreateAdminService {
  name: string;
  categoryKey: string;
  userId?: number | null;
  nodeId?: string;
  memoryMb?: number;
  cpuPercent?: number;
  diskMb?: number;
}

export const adminServicesApi = {
  async list(signal?: AbortSignal): Promise<AdminService[]> {
    const response = await api.get<AdminService[]>('/services/admin/all', { signal });
    return response.data;
  },
  async create(payload: CreateAdminService): Promise<void> {
    await api.post('/services', payload);
  },
  async setOwner(id: string, userId: number | null): Promise<void> {
    await api.patch(`/services/${encodeURIComponent(id)}/owner`, { userId });
  },
};

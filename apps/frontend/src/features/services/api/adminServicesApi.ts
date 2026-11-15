import { api } from '@/shared/api/client';
import type { AdminEgg, EggManifest } from '@shared/types';

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
  updatedAt: string;
  eggId: string | null;
  egg: AdminEgg | null;
  dockerImage: string | null;
  eggConfiguration?: { profileId: string | null; runtimeVersion: string | null } | null;
}

export interface CreateAdminService {
  name: string;
  categoryKey: string;
  userId?: number | null;
  nodeId?: string;
  memoryMb?: number;
  cpuPercent?: number;
  diskMb?: number;
  eggId?: string;
  profileId?: string;
  runtimeVersion?: string;
}

export type UpdateAdminService = Omit<CreateAdminService, 'userId' | 'nodeId' | 'eggId'> & { nodeId?: string | null; eggId?: string | null; expectedUpdatedAt?: string };
export type ServiceEggOption = { id: string; name: string; version: string; manifest: EggManifest };
export type AdminServiceJob = { id: number; type: string; status: string; progress: number; createdAt: string };

export const adminServicesApi = {
  async environment(id: string): Promise<import('@shared/types').ServiceEnvironmentMetadata> { return (await api.get(`/admin/services/${encodeURIComponent(id)}/environment`)).data; },
  async saveEnvironment(id: string, values: Record<string, string | null>) { return (await api.patch(`/admin/services/${encodeURIComponent(id)}/environment`, values)).data; },
  async compatibility(id: string): Promise<{ ready: boolean; contractVersion: number; blockers: string[]; missingVariables: string[] }> { return (await api.get(`/admin/services/${encodeURIComponent(id)}/compatibility`)).data; },
  async updates(id: string): Promise<{ id: string; name: string; version: string }[]> { return (await api.get(`/admin/services/${encodeURIComponent(id)}/egg-updates`)).data; },
  async list(signal?: AbortSignal): Promise<AdminService[]> {
    const response = await api.get<AdminService[]>('/admin/services', { signal });
    return response.data;
  },
  async create(payload: CreateAdminService): Promise<void> {
    await api.post('/admin/services', payload);
  },
  async setOwner(id: string, userId: number | null): Promise<void> {
    await api.patch(`/admin/services/${encodeURIComponent(id)}/owner`, { userId });
  },
  async get(id: string, signal?: AbortSignal): Promise<AdminService> {
    return (await api.get<AdminService>(`/admin/services/${encodeURIComponent(id)}`, { signal })).data;
  },
  async createDraft(payload: CreateAdminService): Promise<AdminService> { return (await api.post<AdminService>('/admin/services', payload)).data; },
  async update(id: string, payload: UpdateAdminService): Promise<AdminService> { return (await api.patch<AdminService>(`/admin/services/${encodeURIComponent(id)}`, payload)).data; },
  async eggs(signal?: AbortSignal): Promise<ServiceEggOption[]> { return (await api.get<ServiceEggOption[]>('/admin/services/available-eggs', { signal })).data; },
  async activeJob(id: string, signal?: AbortSignal): Promise<AdminServiceJob | null> { return (await api.get<AdminServiceJob | null>(`/admin/services/${encodeURIComponent(id)}/jobs/active`, { signal })).data; },
  async jobs(id: string, signal?: AbortSignal): Promise<AdminServiceJob[]> { return (await api.get<AdminServiceJob[]>(`/admin/services/${encodeURIComponent(id)}/jobs`, { signal })).data; },
  async install(id: string, prepare: boolean): Promise<AdminServiceJob> {
    if (prepare) await api.post(`/admin/services/${encodeURIComponent(id)}/prepare-install`);
    return (await api.post<AdminServiceJob>(`/admin/services/${encodeURIComponent(id)}/jobs/install`)).data;
  },
};

import { api } from '@/shared/api/client';

export type RolePermission = { id: string; name: string };
export type RoleDefinition = { id: string; name: string; permissions: RolePermission[] };
export type AdminRole = RoleDefinition & { _count: { users: number } };
export type RoleInput = { name: string; permissionIds: string[] };

const baseUrl = '/admin/rbac/roles';

export const adminRolesApi = {
  async get(id: string, signal?: AbortSignal): Promise<AdminRole> {
    return (await api.get<AdminRole>(`${baseUrl}/${encodeURIComponent(id)}`, { signal })).data;
  },
  async list(signal?: AbortSignal): Promise<AdminRole[]> {
    return (await api.get<AdminRole[]>(baseUrl, { signal })).data;
  },
  async permissions(signal?: AbortSignal): Promise<RolePermission[]> {
    return (await api.get<RolePermission[]>('/admin/rbac/permissions', { signal })).data;
  },
  async create(input: RoleInput): Promise<RoleDefinition> {
    return (await api.post<RoleDefinition>(baseUrl, input)).data;
  },
  async update(id: string, input: RoleInput): Promise<RoleDefinition> {
    return (await api.patch<RoleDefinition>(`${baseUrl}/${encodeURIComponent(id)}`, input)).data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`${baseUrl}/${encodeURIComponent(id)}`);
  },
};

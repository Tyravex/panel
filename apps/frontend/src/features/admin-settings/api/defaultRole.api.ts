import { api } from '@/shared/api/client';

export type DefaultRole = {
    id: string;
    name: string;
};

export const getDefaultRoleApi = () =>
    api.get<DefaultRole>('/admin/rbac/default-role');

export const getEligibleDefaultRolesApi = () =>
    api.get<DefaultRole[]>('/admin/rbac/default-role/eligible');

export const updateDefaultRoleApi = (roleId: string) =>
    api.patch<DefaultRole>('/admin/rbac/default-role', { roleId });

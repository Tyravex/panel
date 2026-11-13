import { api } from '@/shared/api/client';
import type {
    AdminUser,
    UsersResponse,
    AdminUserFormValues,
} from '@shared/types';

export type {
    AdminUser,
    UsersResponse,
    AdminUserFormValues,
} from '@shared/types';

export const emptyAdminUserForm = (): AdminUserFormValues => ({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
});

export const getAdminUsers = async (
    page: number,
    search: string,
    status: string,
    signal: AbortSignal,
): Promise<UsersResponse> => {
    const { data } = await api.get<UsersResponse>('/admin/users', {
        params: { page, search, status },
        signal,
    });

    return data;
};

export const getAdminUser = async (
    id: number,
    signal?: AbortSignal,
): Promise<AdminUser> => {
    const { data } = await api.get<AdminUser>(
        `/admin/users/${id}`,
        { signal },
    );

    return data;
};
export const createAdminUser = async (form: AdminUserFormValues) => {
    await api.post('/admin/users', {
        username: form.username,
        email: form.email,
        password: form.password,
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
    });
};

export const updateAdminUser = async (
    id: number,
    form: AdminUserFormValues,
) => {
    await api.patch(`/admin/users/${id}`, {
        username: form.username,
        email: form.email,
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
    });
};

export const updateAdminUserStatus = async (
    id: number,
    isActive: boolean,
) => {
    await api.patch(`/admin/users/${id}/status`, { isActive });
};
export type AdminUserService = {
  id: string;
  name: string;
  access: 'Owner' | 'Member';
};

export const getAdminUserServices = async (
  id: number,
  signal?: AbortSignal,
): Promise<AdminUserService[]> => {
  const { data } = await api.get<AdminUserService[]>(
    `/admin/users/${id}/services`,
    { signal },
  );
  return data;
};

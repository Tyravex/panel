import { api } from '@/shared/api/client';

export type AdminUser = {
    id: number;
    username: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    isActive: boolean;
    language: string;
    createdAt: string;
    roles: Array<{
        assignedAt: string;
        role: { id: string; name: string };
    }>;
    _count: {
        servers: number;
        services: number;
    };
};

export type UsersResponse = {
    items: AdminUser[];
    total: number;
    page: number;
    limit: number;
    pages: number;
};

export type AdminUserFormValues = {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
};

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
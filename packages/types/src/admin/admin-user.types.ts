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

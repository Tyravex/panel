import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuthStore } from '@/app/store/auth.store';
import {
    getAdminUsers,
    updateAdminUserStatus,
    type AdminUser,
    type UsersResponse,
} from '../api/admin-users.api';

export const useAdminUsers = () => {
    const { t } = useTranslation();
    const me = useAuthStore((state) => state.user);
    const canManage = !!me?.permissions?.includes('user:manage');
    const canCreate = !!me?.permissions?.includes('user:create');
    const canViewRoles = !!me?.permissions?.includes('user:read') &&
        !!me?.permissions?.includes('role:read');

    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [page, setPage] = useState(1);

    const [data, setData] = useState<UsersResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorKey, setErrorKey] = useState<string | null>(null);
    const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);

    const [busy, setBusy] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [pendingStatusUser, setPendingStatusUser] =
        useState<AdminUser | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        setLoading(true);
        setErrorKey(null);

        getAdminUsers(page, query, status, controller.signal)
            .then((response) => {
                if (!controller.signal.aborted) {
                    setData(response);
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setErrorKey('adminUsers.loadError');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [page, query, status, refreshKey]);

    const reload = () => {
        setRefreshKey((value) => value + 1);
    };

    const searchUsers = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPage(1);
        setQuery(search.trim());
    };

    const changeFilter = (value: string) => {
        setStatus(value);
        setPage(1);
    };

    const requestStatusChange = (user: AdminUser) => {
        if (
            busy ||
            !canManage ||
            (user.isActive && user.id === me?.id)
        ) {
            return;
        }

        setActionErrorKey(null);
        setPendingStatusUser(user);
    };

    const cancelStatusChange = useCallback(() => {
        if (!busy) {
            setPendingStatusUser(null);
        }
    }, [busy]);

    const confirmStatusChange = async () => {
        const user = pendingStatusUser;

        if (
            !user ||
            busy ||
            !canManage ||
            (user.isActive && user.id === me?.id)
        ) {
            return;
        }

        setBusy(true);
        setActionErrorKey(null);

        try {
            await updateAdminUserStatus(user.id, !user.isActive);
            toast.success(
                t(
                    user.isActive
                        ? 'adminUsers.disableSuccess'
                        : 'adminUsers.enableSuccess',
                ),
            );
            setPendingStatusUser(null);
            reload();
        } catch {
            setActionErrorKey('adminUsers.operationError');
        } finally {
            setBusy(false);
        }
    };

    return {
        me,
        canManage,
        canCreate,
        canViewRoles,
        search,
        setSearch,
        status,
        page,
        setPage,
        data,
        loading,
        error: errorKey ? t(errorKey) : null,
        actionError: actionErrorKey ? t(actionErrorKey) : null,
        busy,
        reload,
        searchUsers,
        changeFilter,
        pendingStatusUser,
        requestStatusChange,
        cancelStatusChange,
        confirmStatusChange,
    };
};

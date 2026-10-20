import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/app/store/auth.store';
import {
    createAdminUser,
    emptyAdminUserForm,
    getAdminUsers,
    updateAdminUser,
    updateAdminUserStatus,
    type AdminUser,
    type AdminUserFormValues,
    type UsersResponse,
} from '../api/admin-users.api';

export const useAdminUsers = () => {
    const { t } = useTranslation();
    const me = useAuthStore((state) => state.user);
    const canManage = !!me?.permissions?.includes('user:manage');

    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [page, setPage] = useState(1);

    const [data, setData] = useState<UsersResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorKey, setErrorKey] = useState<string | null>(null);
    const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);

    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [editing, setEditing] = useState<AdminUser | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<AdminUserFormValues>(
        emptyAdminUserForm,
    );

    const [busy, setBusy] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Użytkownik oczekujący na potwierdzenie zmiany statusu.
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

    const startCreating = () => {
        if (!canManage || busy) return;

        setCreating(true);
        setEditing(null);
        setForm(emptyAdminUserForm());
        setActionErrorKey(null);
    };

    const startEditing = (user: AdminUser) => {
        if (!canManage || busy) return;

        setEditing(user);
        setCreating(false);

        setForm({
            username: user.username,
            email: user.email,
            password: '',
            firstName: user.firstName ?? '',
            lastName: user.lastName ?? '',
        });

        setActionErrorKey(null);
    };

    const cancelForm = () => {
        if (busy) return;

        setCreating(false);
        setEditing(null);
        setForm(emptyAdminUserForm());
        setActionErrorKey(null);
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (busy || !canManage || (!creating && !editing)) return;

        setBusy(true);
        setActionErrorKey(null);

        try {
            if (creating) {
                await createAdminUser(form);
            } else if (editing) {
                await updateAdminUser(editing.id, form);
            }

            setCreating(false);
            setEditing(null);
            setForm(emptyAdminUserForm());
            reload();
        } catch {
            setActionErrorKey('adminUsers.operationError');
        } finally {
            setBusy(false);
        }
    };

    // Samo kliknięcie Enable/Disable otwiera dialog.
    // Nie wysyłamy tutaj żądania API.
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

    // Żądanie API jest wykonywane dopiero po zatwierdzeniu dialogu.
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
        search,
        setSearch,
        status,
        page,
        setPage,
        data,
        loading,
        error: errorKey ? t(errorKey) : null,
        actionError: actionErrorKey ? t(actionErrorKey) : null,
        selectedUser,
        setSelectedUser,
        editing,
        creating,
        form,
        setForm,
        busy,
        reload,
        searchUsers,
        changeFilter,
        startCreating,
        startEditing,
        cancelForm,
        submit,
        pendingStatusUser,
        requestStatusChange,
        cancelStatusChange,
        confirmStatusChange,
    };
};
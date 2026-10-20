import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SurfaceCard } from '@/shared/ui/SurfaceCard';
import type {
    AdminUser,
    UsersResponse,
} from '../api/admin-users.api';

type Props = {
    search: string;
    setSearch: (value: string) => void;
    status: string;
    onStatusFilter: (value: string) => void;
    onSearch: (event: FormEvent<HTMLFormElement>) => void;
    page: number;
    setPage: (value: number | ((previous: number) => number)) => void;
    data: UsersResponse | null;
    loading: boolean;
    error: string | null;
    busy: boolean;
    canManage: boolean;
    currentUserId?: number;
    onSelectRoles: (user: AdminUser) => void;
    onEdit: (user: AdminUser) => void;
    onChangeStatus: (user: AdminUser) => void;
};

export const AdminUsersTable = ({
    search,
    setSearch,
    status,
    onStatusFilter,
    onSearch,
    page,
    setPage,
    data,
    loading,
    error,
    busy,
    canManage,
    currentUserId,
    onSelectRoles,
    onEdit,
    onChangeStatus,
}: Props) => {
    const { t } = useTranslation();

    return (
        <SurfaceCard>
            <form
                className="mb-5 flex flex-wrap gap-2"
                onSubmit={onSearch}
            >
                <input
                    aria-label={t('adminUsers.search')}
                    placeholder={t('adminUsers.searchPlaceholder')}
                    maxLength={100}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="min-w-48 flex-1 rounded-xl border border-border-subtle bg-transparent px-4 py-2"
                />

                <select
                    aria-label={t('adminUsers.statusFilter')}
                    value={status}
                    onChange={(event) => onStatusFilter(event.target.value)}
                    className="rounded-xl border border-border-subtle bg-surface px-4 py-2"
                >
                    <option value="all">
                        {t('adminUsers.allStatuses')}
                    </option>
                    <option value="active">
                        {t('adminUsers.active')}
                    </option>
                    <option value="disabled">
                        {t('adminUsers.disabled')}
                    </option>
                </select>

                <button
                    type="submit"
                    className="rounded-xl bg-primary px-5 py-2 font-medium text-white"
                >
                    {t('adminUsers.search')}
                </button>
            </form>

            {loading && (
                <p role="status">
                    {t('adminUsers.loading')}
                </p>
            )}

            {error && (
                <p role="alert" className="text-red-400">
                    {error}
                </p>
            )}

            {!loading && !error && data && (
                <>
                    <p className="mb-4 text-sm text-text-secondary">
                        {t('adminUsers.count', { count: data.total })}
                    </p>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-border-subtle text-text-secondary">
                                <tr>
                                    <th className="py-3 pr-4">
                                        {t('adminUsers.user')}
                                    </th>
                                    <th className="py-3 pr-4">
                                        {t('adminUsers.status')}
                                    </th>
                                    <th className="py-3 pr-4">
                                        {t('adminUsers.roles')}
                                    </th>
                                    <th className="py-3 pr-4">
                                        {t('adminUsers.servers')}
                                    </th>
                                    <th className="py-3">
                                        {t('adminUsers.actions')}
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {data.items.map((user) => (
                                    <tr
                                        key={user.id}
                                        className="border-b border-border-subtle/60"
                                    >
                                        <td className="py-3 pr-4">
                                            <strong>{user.username}</strong>

                                            {(user.firstName || user.lastName) && (
                                                <div className="text-text-secondary">
                                                    {[user.firstName, user.lastName]
                                                        .filter(Boolean)
                                                        .join(' ')}
                                                </div>
                                            )}

                                            <div className="text-text-secondary">
                                                {user.email}
                                            </div>
                                        </td>

                                        <td className="py-3 pr-4">
                                            <span
                                                className={
                                                    user.isActive
                                                        ? 'inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400'
                                                        : 'inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400'
                                                }
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className={
                                                        user.isActive
                                                            ? 'h-1.5 w-1.5 rounded-full bg-emerald-400'
                                                            : 'h-1.5 w-1.5 rounded-full bg-red-400'
                                                    }
                                                />

                                                {t(
                                                    user.isActive
                                                        ? 'adminUsers.active'
                                                        : 'adminUsers.disabled',
                                                )}
                                            </span>
                                        </td>

                                        <td className="py-3 pr-4">
                                            {user.roles
                                                .map((entry) => entry.role.name)
                                                .join(', ') || '—'}
                                        </td>

                                        <td className="py-3 pr-4">
                                            {user._count.servers}
                                        </td>

                                        <td className="py-3">
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectRoles(user)}
                                                    className="rounded-lg border border-violet-400/30 px-3 py-1.5 text-violet-200 transition hover:bg-violet-400/10"
                                                >
                                                    {t('adminUsers.roles')}
                                                </button>

                                                {canManage && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => onEdit(user)}
                                                            className="rounded-lg border border-border-subtle px-3 py-1.5 transition hover:bg-white/5"
                                                        >
                                                            {t('adminUsers.edit')}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={
                                                                busy ||
                                                                (user.isActive &&
                                                                    user.id === currentUserId)
                                                            }
                                                            onClick={() => onChangeStatus(user)}
                                                            className={
                                                                user.isActive
                                                                    ? 'rounded-lg border border-red-500/30 px-3 py-1.5 text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40'
                                                                    : 'rounded-lg border border-emerald-500/30 px-3 py-1.5 text-emerald-400 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40'
                                                            }
                                                        >
                                                            {t(
                                                                user.isActive
                                                                    ? 'adminUsers.disable'
                                                                    : 'adminUsers.enable',
                                                            )}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {data.items.length === 0 && (
                            <p className="py-5 text-text-secondary">
                                {t('adminUsers.empty')}
                            </p>
                        )}
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                        <button
                            type="button"
                            className="rounded-lg border border-border-subtle px-4 py-2 disabled:opacity-40"
                            disabled={page <= 1 || loading}
                            onClick={() =>
                                setPage((value) => Math.max(1, value - 1))
                            }
                        >
                            {t('adminUsers.previous')}
                        </button>

                        <span className="text-sm text-text-secondary">
                            {data.page} / {Math.max(1, data.pages)}
                        </span>

                        <button
                            type="button"
                            className="rounded-lg border border-border-subtle px-4 py-2 disabled:opacity-40"
                            disabled={page >= data.pages || loading}
                            onClick={() => setPage((value) => value + 1)}
                        >
                            {t('adminUsers.next')}
                        </button>
                    </div>
                </>
            )}
        </SurfaceCard>
    );
};
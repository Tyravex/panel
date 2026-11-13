import { useTranslation } from 'react-i18next';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { AdminUser, UsersResponse } from '@shared/types';

type Props = {
  search: string;
  setSearch: (value: string) => void;
  status: string;
  onStatusFilter: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  data: UsersResponse | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  canManage: boolean;
  currentUserId?: number;
  onView: (user: AdminUser) => void;
  onSelectRoles: (user: AdminUser) => void;
  onEdit: (user: AdminUser) => void;
  canEditDetails?: boolean;
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
  onView,
  onSelectRoles,
  onEdit,
  canEditDetails = false,
  onChangeStatus,
}: Props) => {
  const { t } = useTranslation();

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          onSubmit={onSearch}
          role="search"
          className="flex min-w-0 flex-1 gap-2"
        >
          <label className="sr-only" htmlFor="admin-users-search">
            {t('adminUsers.search')}
          </label>

          <input
            id="admin-users-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('adminUsers.searchPlaceholder')}
            className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-white/[0.03] px-4 py-2.5 text-sm outline-none transition focus:border-primary"
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-medium transition hover:bg-white/5 disabled:opacity-40"
          >
            {t('adminUsers.search')}
          </button>
        </form>

        <div className="sm:w-52">
          <label className="sr-only" htmlFor="admin-users-status">
            {t('adminUsers.statusFilter')}
          </label>

          <select
            id="admin-users-status"
            value={status}
            onChange={(event) => onStatusFilter(event.target.value)}
            className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-sm"
          >
            <option value="all">{t('adminUsers.allStatuses')}</option>
            <option value="active">{t('adminUsers.active')}</option>
            <option value="disabled">{t('adminUsers.disabled')}</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border-subtle bg-white/[0.03] text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th scope="col" className="px-5 py-4">
                  {t('adminUsers.user')}
                </th>
                <th scope="col" className="px-4 py-4">
                  {t('adminUsers.status')}
                </th>
                <th scope="col" className="px-4 py-4">
                  {t('adminUsers.roles')}
                </th>
                <th scope="col" className="px-4 py-4 text-center">
                  {t('adminUsers.services')}
                </th>
                <th scope="col" className="px-5 py-4 text-right">
                  {t('adminUsers.actions')}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border-subtle">
              {data?.items.map((user) => {
                const isCurrentUser = user.id === currentUserId;
                const roleNames = user.roles.map(
                  (entry) => entry.role.name,
                );

                return (
                  <tr
                    key={user.id}
                    className="transition-colors hover:bg-white/[0.035]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 font-semibold text-primary"
                        >
                          {user.username.slice(0, 1).toUpperCase()}
                        </span>

                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onView(user)}
                            className="block max-w-[260px] truncate text-left font-semibold hover:text-primary hover:underline"
                          >
                            {user.username}
                          </button>
                          <span className="block max-w-[260px] truncate text-xs text-text-secondary">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={
                          user.isActive
                            ? 'inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300'
                            : 'inline-flex rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300'
                        }
                      >
                        {t(
                          user.isActive
                            ? 'adminUsers.active'
                            : 'adminUsers.disabled',
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex max-w-[220px] flex-wrap gap-1.5">
                        {roleNames.length > 0 ? (
                          roleNames.map((name, index) => (
                            <span
                              key={`${user.id}-${index}`}
                              className="rounded-md border border-border-subtle bg-white/[0.04] px-2 py-1 text-xs text-text-secondary"
                            >
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-text-secondary">
                            —
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center font-medium">
                      {user._count.services}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectRoles(user)}
                          className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-medium transition hover:bg-white/5"
                        >
                          {t('adminUsers.roles')}
                        </button>

                        {canManage && canEditDetails && (
                          <button
                            type="button"
                            onClick={() => onEdit(user)}
                            className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-medium transition hover:bg-white/5"
                          >
                            {t('adminUsers.edit')}
                          </button>
                        )}

                        {canManage && (
                          <button
                            type="button"
                            disabled={busy || (user.isActive && isCurrentUser)}
                            onClick={() => onChangeStatus(user)}
                            className={
                              user.isActive
                                ? 'rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40'
                                : 'rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40'
                            }
                          >
                            {t(
                              user.isActive
                                ? 'adminUsers.disable'
                                : 'adminUsers.enable',
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {loading && (
          <p role="status" className="px-5 py-8 text-center text-sm text-text-secondary">
            {t('adminUsers.loading')}
          </p>
        )}

        {!loading && error && (
          <p role="alert" className="px-5 py-8 text-center text-sm text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && data?.items.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-text-secondary">
            {t('adminUsers.empty')}
          </p>
        )}

        {data && data.pages > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-4">
            <p className="text-xs text-text-secondary">
              {t('adminUsers.count', { count: data.total })}
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-border-subtle px-3 py-2 text-xs transition hover:bg-white/5 disabled:opacity-40"
              >
                {t('adminUsers.previous')}
              </button>

              <span className="text-xs tabular-nums text-text-secondary">
                {data.page} / {data.pages}
              </span>

              <button
                type="button"
                disabled={page >= data.pages || loading}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-border-subtle px-3 py-2 text-xs transition hover:bg-white/5 disabled:opacity-40"
              >
                {t('adminUsers.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

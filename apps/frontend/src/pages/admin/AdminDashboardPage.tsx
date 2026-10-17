import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/shared/api/client';
import { SurfaceCard } from '@/shared/ui/SurfaceCard';
import { RoleManagementPanel } from './RoleManagementPanel';

type AdminUser = {
  id: number;
  username: string;
  email: string;
  language: string;
  createdAt: string;
  roles: Array<{ assignedAt: string; role: { id: string; name: string } }>;
  _count: { servers: number; services: number };
};
type UsersResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export const AdminDashboardPage = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api.get<UsersResponse>('/admin/users', {
      params: { page, search: query },
      signal: controller.signal,
    }).then(({ data: response }) => setData(response))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Request failed');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, query, refreshKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">Tyravex / Administration / Users</p>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('admin.users.title', { defaultValue: 'User management' })}
          </h1>
          <p className="mt-2 text-text-secondary">
            {t('admin.users.description', { defaultValue: 'Browse users and inspect their roles and services.' })}
          </p>
        </div>
        <Link to="/dashboard" className="rounded-xl border border-border-subtle px-4 py-2 text-sm hover:bg-white/5">
          {t('admin.dashboard.backToUser', { defaultValue: 'Back to user dashboard' })}
        </Link>
      </div>

      <SurfaceCard>
        <form className="mb-5 flex flex-wrap gap-2" onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}>
          <input
            aria-label="Search users"
            className="min-w-56 flex-1 rounded-xl border border-border-subtle bg-transparent px-4 py-2"
            placeholder={t('admin.users.search', { defaultValue: 'Search username or email' })}
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit" className="rounded-xl bg-primary px-5 py-2 font-medium text-white">
            {t('admin.users.searchButton', { defaultValue: 'Search' })}
          </button>
        </form>

        {loading && <p role="status">{t('common.loading', { defaultValue: 'Loading...' })}</p>}
        {error && <p role="alert" className="text-red-400">{error}</p>}
        {!loading && !error && data && (
          <>
            <p className="mb-4 text-sm text-text-secondary">{data.total} users</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-subtle text-text-secondary">
                  <tr><th className="py-3 pr-4">User</th><th className="pr-4">Roles</th><th className="pr-4">Servers</th><th className="pr-4">Services</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {data.items.map((user) => (
                    <tr key={user.id} className="border-b border-border-subtle/60">
                      <td className="py-3 pr-4"><strong>{user.username}</strong><div className="text-text-secondary">{user.email}</div></td>
                      <td className="pr-4">{user.roles.map((entry) => entry.role.name).join(', ') || '—'}</td>
                      <td className="pr-4">{user._count.servers}</td>
                      <td className="pr-4">{user._count.services}</td>
                      <td><button type="button" onClick={() => setSelectedUser(user)} className="rounded-lg border border-violet-400/30 px-3 py-1.5 text-violet-200 hover:bg-violet-400/10">Manage roles</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.items.length === 0 && <p className="py-5 text-text-secondary">No users found.</p>}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <button className="rounded-lg border border-border-subtle px-4 py-2 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
              <span>{data.page} / {Math.max(1, data.pages)}</span>
              <button className="rounded-lg border border-border-subtle px-4 py-2 disabled:opacity-40" disabled={page >= data.pages} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          </>
        )}
      </SurfaceCard>
      {selectedUser && (
        <RoleManagementPanel
          key={selectedUser.id}
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onChanged={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </div>
  );
};

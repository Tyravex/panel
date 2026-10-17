import { useEffect, useState } from 'react';
import { api } from '@/shared/api/client';
import { SurfaceCard } from '@/shared/ui/SurfaceCard';
import { useAuthStore } from '@/app/store/auth.store';
import { RoleManagementPanel } from './RoleManagementPanel';

type AdminUser = { id: number; username: string; email: string; isActive: boolean; language: string; createdAt: string; roles: Array<{ assignedAt: string; role: { id: string; name: string } }>; _count: { servers: number; services: number } };
type UsersResponse = { items: AdminUser[]; total: number; page: number; limit: number; pages: number };
const initial = { username: '', email: '', password: '' };

export const AdminDashboardPage = () => {
  const me = useAuthStore((state) => state.user);
  const canManage = !!me?.permissions?.includes('user:manage');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api.get<UsersResponse>('/admin/users', { params: { page, search: query, status }, signal: controller.signal })
      .then(({ data: response }) => setData(response))
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Request failed'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, query, status, refreshKey]);

  const reload = () => setRefreshKey((value) => value + 1);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setActionError('');
    try {
      if (creating) await api.post('/admin/users', form);
      else if (editing) await api.patch(`/admin/users/${editing.id}`, { username: form.username, email: form.email });
      setCreating(false); setEditing(null); setForm(initial); reload();
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : 'Operation failed'); }
    finally { setBusy(false); }
  };
  const changeStatus = async (user: AdminUser) => {
    const verb = user.isActive ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${verb} ${user.username}?`)) return;
    setBusy(true); setActionError('');
    try { await api.patch(`/admin/users/${user.id}/status`, { isActive: !user.isActive }); reload(); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : 'Operation failed'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="mb-2 text-sm font-medium text-primary">Tyravex / Administration / Users</p><h1 className="text-3xl font-bold">User management</h1><p className="mt-2 text-text-secondary">Manage accounts, status and roles.</p></div>
      {canManage && <button type="button" onClick={() => { setCreating(true); setEditing(null); setForm(initial); setActionError(''); }} className="rounded-xl bg-primary px-5 py-2 font-medium text-white">Create user</button>}
    </header>
    {actionError && <p role="alert" className="text-red-400">{actionError}</p>}
    {(creating || editing) && <SurfaceCard><form onSubmit={submit} className="space-y-3"><h2 className="text-lg font-semibold">{creating ? 'Create user' : 'Edit user'}</h2>
      <label className="block text-sm">Username<input required minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]+" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-1 w-full rounded-lg border border-border-subtle bg-transparent p-2" /></label>
      <label className="block text-sm">Email<input required type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border border-border-subtle bg-transparent p-2" /></label>
      {creating && <label className="block text-sm">Initial password<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 w-full rounded-lg border border-border-subtle bg-transparent p-2" /></label>}
      <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50">Save</button><button type="button" onClick={() => { setCreating(false); setEditing(null); }} className="rounded-lg border border-border-subtle px-4 py-2">Cancel</button></div>
    </form></SurfaceCard>}
    <SurfaceCard>
      <form className="mb-5 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}>
        <input aria-label="Search users" placeholder="Search username or email" maxLength={100} value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-48 flex-1 rounded-xl border border-border-subtle bg-transparent px-4 py-2" />
        <select aria-label="Account status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-xl border border-border-subtle bg-surface px-4 py-2"><option value="all">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option></select>
        <button className="rounded-xl bg-primary px-5 py-2 font-medium text-white">Search</button>
      </form>
      {loading && <p role="status">Loading...</p>}{error && <p role="alert" className="text-red-400">{error}</p>}
      {!loading && !error && data && <><p className="mb-4 text-sm text-text-secondary">{data.total} users</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border-subtle text-text-secondary"><tr><th className="py-3 pr-4">User</th><th>Status</th><th>Roles</th><th>Servers</th><th>Actions</th></tr></thead><tbody>
        {data.items.map((user) => <tr key={user.id} className="border-b border-border-subtle/60"><td className="py-3 pr-4"><strong>{user.username}</strong><div className="text-text-secondary">{user.email}</div></td><td>{user.isActive ? 'Active' : 'Disabled'}</td><td>{user.roles.map((entry) => entry.role.name).join(', ') || '—'}</td><td>{user._count.servers}</td><td><div className="flex flex-wrap gap-2 py-2"><button type="button" onClick={() => setSelectedUser(user)} className="rounded-lg border border-violet-400/30 px-3 py-1.5 text-violet-200">Roles</button>{canManage && <><button type="button" onClick={() => { setEditing(user); setCreating(false); setForm({ username: user.username, email: user.email, password: '' }); setActionError(''); }} className="rounded-lg border border-border-subtle px-3 py-1.5">Edit</button><button type="button" disabled={busy || (user.isActive && user.id === me?.id)} onClick={() => void changeStatus(user)} className="rounded-lg border border-border-subtle px-3 py-1.5 disabled:opacity-40">{user.isActive ? 'Disable' : 'Enable'}</button></>}</div></td></tr>)}
      </tbody></table>{data.items.length === 0 && <p className="py-5 text-text-secondary">No users found.</p>}</div><div className="mt-5 flex items-center justify-between gap-3"><button type="button" className="rounded-lg border border-border-subtle px-4 py-2 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>Previous</button><span>{data.page} / {Math.max(1, data.pages)}</span><button type="button" className="rounded-lg border border-border-subtle px-4 py-2 disabled:opacity-40" disabled={page >= data.pages} onClick={() => setPage((v) => v + 1)}>Next</button></div></>}
    </SurfaceCard>
    {selectedUser && <RoleManagementPanel key={selectedUser.id} user={selectedUser} onClose={() => setSelectedUser(null)} onChanged={reload} />}
  </div>;
};

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/shared/api/client';
import { SurfaceCard } from '@/shared/ui/SurfaceCard';

type Permission = { id: string; name: string };
type Role = { id: string; name: string; permissions: Permission[]; _count: { users: number } };

const messageOf = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string | string[] } } }).response?.data;
    if (typeof data?.message === 'string') return data.message;
    if (Array.isArray(data?.message)) return data.message.join(', ');
  }
  return error instanceof Error ? error.message : 'Request failed';
};

export const AdminRolesPage = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const [roleResult, permissionResult] = await Promise.all([
      api.get<Role[]>('/admin/rbac/roles', { signal }),
      api.get<Permission[]>('/admin/rbac/permissions', { signal }),
    ]);
    if (!signal?.aborted) {
      setRoles(roleResult.data);
      setPermissions(permissionResult.data);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(messageOf(reason));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [refresh]);

  const editRole = (role: Role) => {
    setEditingId(role.id);
    setName(role.name);
    setSelected(role.permissions.map((permission) => permission.id));
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setSelected([]);
  };

  const deleteRole = async (role: Role) => {
    if (saving || role.name.toLowerCase() === 'owner') return;
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.delete(`/admin/rbac/roles/${encodeURIComponent(role.id)}`);
      await refresh();
      if (editingId === role.id) resetForm();
      setNotice('Role deleted.');
    } catch (reason: unknown) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  };

  const createRole = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      // The server validates both the role name and every selected permission.
      if (editingId) {
        await api.patch(`/admin/rbac/roles/${encodeURIComponent(editingId)}`, { name: name.trim(), permissionIds: selected });
      } else {
        await api.post('/admin/rbac/roles', { name: name.trim(), permissionIds: selected });
      }
      await refresh();
      setNotice(editingId ? 'Role updated successfully.' : 'Role created successfully. You can now assign it to users.');
      resetForm();
    } catch (reason: unknown) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Tyravex / Administration / RBAC</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Roles &amp; Permissions</h1>
        <p className="mt-2 text-text-secondary">Create, edit and delete roles, or compare their permissions.</p>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">{notice}</p>}
      <SurfaceCard>
        <h2 className="mb-4 text-xl font-semibold">{editingId ? "Edit role" : "Create role"}</h2>
        <form onSubmit={(event) => void createRole(event)} className="space-y-5">
          <label className="block space-y-2 text-sm font-medium">
            <span>Role name</span>
            <input required minLength={3} maxLength={50} pattern="[A-Za-z][A-Za-z0-9 _-]{2,49}" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Support Moderator" className="block w-full rounded-xl border border-border-subtle bg-transparent px-4 py-3" />
          </label>
          <fieldset disabled={saving || loading} className="space-y-3">
            <legend className="mb-3 font-medium">Permissions ({selected.length} selected)</legend>
            {loading && <p className="text-sm text-text-secondary">Loading permissions...</p>}
            {!loading && permissions.length === 0 && <p className="text-sm text-text-secondary">No permissions available in the database.</p>}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {permissions.map((permission) => (
                <label key={permission.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border-subtle bg-white/[0.02] p-3 text-sm hover:bg-white/5">
                  <input type="checkbox" checked={selected.includes(permission.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, permission.id] : current.filter((id) => id !== permission.id))} className="accent-violet-500" />
                  <span className="font-mono text-xs">{permission.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" disabled={saving || loading} className="rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : editingId ? 'Save changes' : 'Create role'}</button>
          {editingId && <button type="button" onClick={resetForm} className="ml-3 rounded-xl border border-border-subtle px-5 py-3">Cancel</button>}
        </form>
      </SurfaceCard>
      <SurfaceCard>
        <h2 className="mb-4 text-xl font-semibold">Existing roles</h2>
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="rounded-xl border border-border-subtle p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <strong>{role.name}</strong>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-secondary">{role._count.users} users</span>
                  {role.name.toLowerCase() !== 'owner' && <>
                    <button type="button" disabled={saving} onClick={() => editRole(role)} className="rounded-lg border border-border-subtle px-3 py-1 text-sm hover:bg-white/5">Edit</button>
                    <button type="button" disabled={saving || role._count.users > 0} title={role._count.users > 0 ? 'Unassign all users first' : 'Delete role'} onClick={() => void deleteRole(role)} className="rounded-lg border border-red-500/30 px-3 py-1 text-sm text-red-300 disabled:opacity-40">Delete</button>
                  </>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {role.permissions.length === 0 && <span className="text-xs text-text-secondary">No permissions</span>}
                {role.permissions.map((permission) => <span key={permission.id} className="rounded-lg border border-border-subtle px-2 py-1 font-mono text-xs text-text-secondary">{permission.name}</span>)}
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>
      <SurfaceCard>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Permission matrix</h2>
          <button type="button" onClick={() => setShowMatrix((value) => !value)} className="rounded-xl border border-border-subtle px-4 py-2 text-sm">{showMatrix ? 'Hide matrix' : 'Show matrix'}</button>
        </div>
        {showMatrix && <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead><tr><th className="border-b border-border-subtle p-3">Permission</th>{roles.map((role) => <th key={role.id} className="border-b border-border-subtle p-3">{role.name}</th>)}</tr></thead>
            <tbody>{permissions.map((permission) => <tr key={permission.id}>
              <th className="border-b border-border-subtle p-3 font-mono text-xs">{permission.name}</th>
              {roles.map((role) => <td key={role.id} className="border-b border-border-subtle p-3 text-center">{role.permissions.some((item) => item.id === permission.id) ? '✓' : '—'}</td>)}
            </tr>)}</tbody>
          </table>
        </div>}
      </SurfaceCard>
    </div>
  );
};

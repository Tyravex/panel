import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/app/store/auth.store';
import { adminRolesApi, type AdminRole, type RolePermission, type RoleInput } from '@/features/admin-roles/api/adminRolesApi';
import { AdminRoleForm } from '@/features/admin-roles/components/AdminRoleForm';
import { roleErrorMessage } from '@/features/admin-roles/lib/roleErrorMessage';
import { SurfaceCard } from '@/shared/ui/SurfaceCard';
import { RoleChangeSummary } from '@/features/admin-roles/components/RoleChangeSummary';
import { getRoleChanges, type RoleChanges } from '@/features/admin-roles/lib/roleChanges';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';

export const AdminRoleEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canManage = !!permissions?.includes('role:read') && !!permissions?.includes('role:manage');
  const [role, setRole] = useState<AdminRole | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [noChanges, setNoChanges] = useState(false);
  const [pending, setPending] = useState<{ roleId: string; input: RoleInput; changes: RoleChanges; usersCount: number } | null>(null);
  const isOwner = role?.name.toLowerCase() === 'owner';
  // Match loaded data to the current URL before allowing a save.
  const canEdit = canManage && !loading && !!role && role.id === id && !isOwner;
  const unsaved = useUnsavedChanges(canEdit && !!role && getRoleChanges(role, { name, permissionIds: selected }, catalog).changed);

  useEffect(() => {
    setRole(null);
    setName('');
    setSelected([]);
    setError('');
    setNotFound(false);
    setPending(null);
    setNoChanges(false);
    if (!canManage || !id?.trim()) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void Promise.all([adminRolesApi.get(id, controller.signal), adminRolesApi.permissions(controller.signal)])
      .then(([found, available]) => {
        if (controller.signal.aborted) return;
        setRole(found);
        setName(found.name);
        setSelected(found.permissions.map((permission) => permission.id));
        setCatalog(available);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          if ((reason as { response?: { status?: number } })?.response?.status === 404) setNotFound(true);
          else setError(roleErrorMessage(reason));
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, canManage]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || !role || !id || saving || pending) return;
    const input = { name: name.trim(), permissionIds: [...selected] };
    const changes = getRoleChanges(role, input, catalog);
    setError('');
    setNoChanges(!changes.changed);
    if (changes.changed) setPending({ roleId: id, input, changes, usersCount: role._count.users });
  };

  const confirmSave = async () => {
    if (!canEdit || !id || !pending || pending.roleId !== id || saving) return;
    setSaving(true);
    setError('');
    try {
      await adminRolesApi.update(id, pending.input);
      unsaved.markSaved();
      setPending(null);
      toast.success(t('adminRoles.updated'));
      navigate('/admin/roles');
    } catch (reason: unknown) {
      setPending(null);
      setError(roleErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link to="/admin/roles" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-primary">
          <ArrowLeft size={16} aria-hidden="true" />{t('adminRoles.backToRoles')}
        </Link>
        <h1 className="text-3xl font-bold">{t('adminRoles.editRole')}</h1>
        <p className="text-text-secondary">{t('adminRoles.editDescription')}</p>
      </header>
      {canManage && loading && <p role="status">{t('adminRoles.loadingRole')}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p>}
      {notFound && <p role="alert">{t('adminRoles.roleNotFound')}</p>}
      {noChanges && <p role="status">{t('adminRoles.review.noChanges')}</p>}
      {!loading && isOwner && <p role="alert">{t('adminRoles.ownerProtected')}</p>}
      {canEdit && <SurfaceCard>
        <AdminRoleForm name={name} setName={(value) => { setNoChanges(false); setName(value); }}
          selected={selected} setSelected={(value) => { setNoChanges(false); setSelected(value); }}
          permissions={catalog} loading={loading} saving={saving} disabled={!!pending}
          onSubmit={submit} onCancel={() => navigate('/admin/roles')} />
      </SurfaceCard>}
      <RoleChangeSummary open={!unsaved.blocked && !!pending && canEdit && pending.roleId === id} changes={pending?.changes ?? null}
        usersCount={pending?.usersCount ?? 0} saving={saving} onConfirm={() => void confirmSave()}
        onCancel={() => { if (!saving) setPending(null); }} />
    </div>
  );
};

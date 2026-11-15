import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/app/store/auth.store';
import { adminRolesApi, type RolePermission } from '@/features/admin-roles/api/adminRolesApi';
import { AdminRoleForm } from '@/features/admin-roles/components/AdminRoleForm';
import { roleErrorMessage } from '@/features/admin-roles/lib/roleErrorMessage';
import { SurfaceCard } from '@/shared/ui/SurfaceCard';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';

export const AdminRoleCreatePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canCreate = !!permissions?.includes('role:read') && !!permissions?.includes('role:manage');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const unsaved = useUnsavedChanges(canCreate && (name.length > 0 || selected.length > 0));

  useEffect(() => {
    if (!canCreate) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    void adminRolesApi.permissions(controller.signal)
      .then((result) => { if (!controller.signal.aborted) setCatalog(result); })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(roleErrorMessage(reason));
          setLoadFailed(true);
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [canCreate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate || saving || loading || loadFailed) return;
    setSaving(true);
    setError('');
    try {
      await adminRolesApi.create({ name: name.trim(), permissionIds: selected });
      unsaved.markSaved();
      toast.success(t('adminRoles.created'));
      navigate('/admin/roles');
    } catch (reason: unknown) {
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
        <h1 className="text-3xl font-bold">{t('adminRoles.createRole')}</h1>
        <p className="text-text-secondary">{t('adminRoles.createDescription')}</p>
      </header>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p>}
      {canCreate && <SurfaceCard>
        <AdminRoleForm creating name={name} setName={setName} selected={selected} setSelected={setSelected}
          permissions={catalog} loading={loading} saving={saving} disabled={loadFailed}
          onSubmit={(event) => void submit(event)} onCancel={() => navigate('/admin/roles')} />
      </SurfaceCard>}
    </div>
  );
};

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/app/store/auth.store';
import { adminRolesApi, type AdminRole, type RolePermission } from '@/features/admin-roles/api/adminRolesApi';
import { roleErrorMessage } from '@/features/admin-roles/lib/roleErrorMessage';
import { AdminRolesNavigation } from '@/features/admin-roles/components/AdminRolesNavigation';
import { RoleComparison } from '@/features/admin-roles/components/RoleComparison';

export const AdminRoleComparePage = () => {
  const { t } = useTranslation();
  const canRead = useAuthStore((state) => !!state.user?.permissions?.includes('role:read'));
  const [data, setData] = useState<{ roles: AdminRole[]; permissions: RolePermission[] } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    setData(null);
    setError('');
    void Promise.all([adminRolesApi.list(controller.signal), adminRolesApi.permissions(controller.signal)])
      .then(([roles, permissions]) => { if (!controller.signal.aborted) setData({ roles, permissions }); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(roleErrorMessage(reason)); });
    return () => controller.abort();
  }, [canRead, retry]);
  return <div className="space-y-6">
    <header className="space-y-2">
      <p className="text-sm font-medium text-primary">{t('adminRoles.breadcrumb')}</p>
      <h1 className="text-3xl font-bold">{t('adminRoles.compare.title')}</h1>
      <p className="text-text-secondary">{t('adminRoles.compare.description')}</p>
    </header>
    <AdminRolesNavigation />
    {canRead && (error ? <div className="space-y-3">
      <p role="alert" className="text-red-300">{error}</p>
      <button type="button" onClick={() => setRetry((value) => value + 1)}
        className="rounded-xl border border-border-subtle px-4 py-2">{t('adminRoles.compare.retry')}</button>
    </div> : data ? <RoleComparison roles={data.roles} permissions={data.permissions} />
      : <p role="status">{t('adminRoles.compare.loading')}</p>)}
  </div>;
};

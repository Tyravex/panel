import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/app/store/auth.store';
import { Link } from 'react-router-dom';
import { adminRolesApi, type AdminRole as Role } from '@/features/admin-roles/api/adminRolesApi';
import { AdminRolesNavigation } from '@/features/admin-roles/components/AdminRolesNavigation';
import { AdminRolesFilters } from '@/features/admin-roles/components/AdminRolesFilters';
import { AdminRolesTable } from '@/features/admin-roles/components/AdminRolesTable';
import { groupRolePermissions, isCatalogPermission, permissionTranslationKey } from '@/features/admin-roles/lib/groupRolePermissions';
import { roleErrorMessage as messageOf } from '@/features/admin-roles/lib/roleErrorMessage';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

export const AdminRolesPage = () => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const canManageRoles = !!user?.permissions?.includes('role:manage');

  const [roles, setRoles] = useState<Role[]>([]);
  const [query, setQuery] = useState('');
  const [module, setModule] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [pendingDeleteRole, setPendingDeleteRole] = useState<Role | null>(
    null,
  );

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const roleResult = await adminRolesApi.list(signal);

    if (!signal?.aborted) {
      setRoles(roleResult);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    refresh(controller.signal)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(messageOf(reason));
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [refresh]);

  const requestDeleteRole = (role: Role) => {
    if (
      !canManageRoles ||
      saving ||
      role.name.toLowerCase() === 'owner' ||
      role._count.users > 0
    ) {
      return;
    }

    setError('');
    setNotice('');
    setPendingDeleteRole(role);
  };

  const cancelDeleteRole = () => {
    if (!saving) {
      setPendingDeleteRole(null);
    }
  };

  const confirmDeleteRole = async () => {
    const role = pendingDeleteRole;

    if (
      !role ||
      !canManageRoles ||
      saving ||
      role.name.toLowerCase() === 'owner' ||
      role._count.users > 0
    ) {
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await adminRolesApi.remove(role.id);

      await refresh();

      setPendingDeleteRole(null);
      setNotice(t('adminRoles.deleted'));
    } catch (reason: unknown) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  };

  const modules = groupRolePermissions(roles.flatMap((role) => role.permissions)).map((group) => group.id);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredRoles = roles.filter((role) => {
    const matchesModule = module === 'all' || groupRolePermissions(role.permissions).some((group) => group.id === module);
    const matchesSearch = !normalizedQuery || [role.name, ...role.permissions.flatMap((permission) => [
      permission.name,
      isCatalogPermission(permission.name) ? t(`adminRoles.permissionLabels.${permissionTranslationKey(permission.name)}`) : '',
    ])].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    return matchesModule && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">
          {t('adminRoles.breadcrumb')}
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {t('adminRoles.title')}
        </h1>

        <p className="mt-2 text-text-secondary">
          {t('adminRoles.description')}
        </p>
      </div>

      <AdminRolesNavigation />

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300"
        >
          {notice}
        </p>
      )}

      {canManageRoles && (
        <Link to="/admin/roles/new" className="inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-white">
          {t('adminRoles.createRole')}
        </Link>
      )}

      <AdminRolesFilters query={query} module={module} modules={modules}
        onQueryChange={setQuery} onModuleChange={setModule} />
      <AdminRolesTable roles={filteredRoles} total={roles.length} loading={loading}
        canManage={canManageRoles} saving={saving} onDelete={requestDeleteRole} />



      <ConfirmDialog
        open={pendingDeleteRole !== null}
        destructive
        busy={saving}
        title={t('adminRoles.deleteTitle')}
        description={
          <div className="space-y-3">
            <p>
              {t('adminRoles.confirmDelete', {
                role: pendingDeleteRole?.name ?? '',
              })}
            </p>

            <p className="text-red-400">
              {t('adminRoles.cannotUndo')}
            </p>

            {error && (
              <p role="alert" className="text-red-400">
                {error}
              </p>
            )}
          </div>
        }
        confirmLabel={t('adminRoles.deleteRole')}
        onCancel={cancelDeleteRole}
        onConfirm={() => void confirmDeleteRole()}
      />
    </div>
  );
};

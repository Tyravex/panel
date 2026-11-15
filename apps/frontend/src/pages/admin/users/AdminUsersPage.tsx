import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useAdminUsers } from '@/features/admin-users/hooks/useAdminUsers';
import { AdminUsersTable } from '@/features/admin-users/components/AdminUsersTable';

export const AdminUsersPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const users = useAdminUsers();
  const pendingUser = users.pendingStatusUser;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">
            {t('adminUsers.breadcrumb')}
          </p>

          <h1 className="text-3xl font-bold">
            {t('adminUsers.title')}
          </h1>

          <p className="mt-2 text-text-secondary">
            {t('adminUsers.description')}
          </p>
        </div>

        {users.canCreate && (
          <button
            type="button"
            onClick={() => navigate('/admin/users/new')}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <span aria-hidden="true" className="text-lg leading-none">+</span>
            {t('adminUsers.createUser')}
          </button>
        )}
      </header>

      {users.actionError && (
        <p role="alert" className="text-sm text-red-400">
          {users.actionError}
        </p>
      )}

      <AdminUsersTable
        search={users.search}
        setSearch={users.setSearch}
        status={users.status}
        onStatusFilter={users.changeFilter}
        onSearch={users.searchUsers}
        page={users.page}
        setPage={users.setPage}
        data={users.data}
        loading={users.loading}
        error={users.error}
        busy={users.busy}
        canManage={users.canManage}
        canViewRoles={users.canViewRoles}
        currentUserId={users.me?.id}
        onView={(user) => navigate(`/admin/users/${user.id}`)}
        onSelectRoles={(user) => navigate(`/admin/users/${user.id}/roles`)}
        onEdit={(user) => navigate(`/admin/users/${user.id}/edit`)}
        canEditDetails={true}
        onChangeStatus={users.requestStatusChange}
      />

      <ConfirmDialog
        open={pendingUser !== null}
        destructive={pendingUser?.isActive ?? false}
        busy={users.busy}
        title={t(
          pendingUser?.isActive
            ? 'adminUsers.disableTitle'
            : 'adminUsers.enableTitle',
        )}
        description={t(
          pendingUser?.isActive
            ? 'adminUsers.confirmDisable'
            : 'adminUsers.confirmEnable',
          { username: pendingUser?.username ?? '' },
        )}
        confirmLabel={t(
          pendingUser?.isActive
            ? 'adminUsers.disable'
            : 'adminUsers.enable',
        )}
        onCancel={users.cancelStatusChange}
        onConfirm={() => void users.confirmStatusChange()}
      />
    </div>
  );
};

import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { RoleManagementPanel } from './RoleManagementPanel';
import { useAdminUsers } from '@/features/admin-users/hooks/useAdminUsers';
import { AdminUserForm } from '@/features/admin-users/components/AdminUserForm';
import { AdminUsersTable } from '@/features/admin-users/components/AdminUsersTable';

export const AdminDashboardPage = () => {
  const { t } = useTranslation();
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

        {users.canManage && (
          <button
            type="button"
            onClick={users.startCreating}
            disabled={users.busy}
            className="rounded-xl bg-primary px-5 py-2 font-medium text-white disabled:opacity-40"
          >
            {t('adminUsers.createUser')}
          </button>
        )}
      </header>

      {users.actionError && (
        <p role="alert" className="text-red-400">
          {users.actionError}
        </p>
      )}

      {(users.creating || users.editing) && users.canManage && (
        <AdminUserForm
          creating={users.creating}
          form={users.form}
          setForm={users.setForm}
          busy={users.busy}
          onSubmit={users.submit}
          onCancel={users.cancelForm}
        />
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
        currentUserId={users.me?.id}
        onSelectRoles={users.setSelectedUser}
        onEdit={users.startEditing}
        onChangeStatus={users.requestStatusChange}
      />

      {users.selectedUser && (
        <RoleManagementPanel
          key={users.selectedUser.id}
          user={users.selectedUser}
          onClose={() => users.setSelectedUser(null)}
          onChanged={users.reload}
        />
      )}

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
          {
            username: pendingUser?.username ?? '',
          },
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
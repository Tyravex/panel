import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/shared/api/client';
import { SurfaceCard } from '@/shared/ui/SurfaceCard';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

type Permission = {
  id: string;
  name: string;
};

type Role = {
  id: string;
  name: string;
  permissions: Permission[];
  _count: {
    users: number;
  };
};

type Assignment = {
  assignedAt: string;
  role: {
    id: string;
    name: string;
    permissions: Permission[];
  };
};

type Props = {
  user: {
    id: number;
    username: string;
    email: string;
  };
  onClose: () => void;
  onChanged: () => void;
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: string | string[];
          };
        };
      }
    ).response;

    const message = response?.data?.message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message.join(', ');
    }
  }

  return error instanceof Error ? error.message : 'Request failed';
}

export const RoleManagementPanel = ({
  user,
  onClose,
  onChanged,
}: Props) => {
  const { t } = useTranslation();

  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Rola oczekująca na potwierdzenie usunięcia.
  const [pendingRoleRemoval, setPendingRoleRemoval] =
    useState<Role | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const [rolesResponse, assignmentsResponse] =
        await Promise.all([
          api.get<Role[]>('/admin/rbac/roles', { signal }),
          api.get<Assignment[]>(
            `/admin/rbac/users/${user.id}/roles`,
            { signal },
          ),
        ]);

      if (!signal?.aborted) {
        setRoles(rolesResponse.data);
        setAssignments(assignmentsResponse.data);
      }
    },
    [user.id],
  );

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError('');
    setNotice('');

    load(controller.signal)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(reason));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [load]);

  const changeRole = async (role: Role, assigned: boolean) => {
    if (busyRole) return;

    setBusyRole(role.id);
    setError('');
    setNotice('');

    try {
      const path =
        `/admin/rbac/users/${user.id}/roles/` +
        encodeURIComponent(role.id);

      if (assigned) {
        await api.delete(path);
      } else {
        await api.post(path);
      }

      // Pobieramy aktualny stan z backendu.
      await load();

      // Zamykamy potwierdzenie dopiero po udanej operacji.
      if (assigned) {
        setPendingRoleRemoval(null);
      }

      onChanged();

      setNotice(
        assigned
          ? t('adminUsers.roleRemoved')
          : t('adminUsers.roleAssigned'),
      );
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setBusyRole(null);
    }
  };

  const requestRoleRemoval = (role: Role) => {
    if (busyRole) return;

    setError('');
    setPendingRoleRemoval(role);
  };

  const cancelRoleRemoval = () => {
    if (!busyRole) {
      setPendingRoleRemoval(null);
    }
  };

  const assignedIds = new Set(
    assignments.map((entry) => entry.role.id),
  );

  return (
    <SurfaceCard>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {t('adminUsers.rolesBreadcrumb')}
          </p>

          <h2 className="mt-1 text-xl font-semibold">
            {user.username}
          </h2>

          <p className="text-sm text-text-secondary">
            {user.email} · ID {user.id}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={busyRole !== null}
          className="rounded-xl border border-border-subtle px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
        >
          {t('common.close')}
        </button>
      </div>

      {loading && (
        <p role="status" className="text-text-secondary">
          {t('adminUsers.loadingRoles')}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"
        >
          {notice}
        </p>
      )}

      {!loading && (
        <div className="space-y-3">
          {roles.length === 0 && (
            <p className="text-sm text-text-secondary">
              {t('adminUsers.noRoles')}
            </p>
          )}

          {roles.map((role) => {
            const assigned = assignedIds.has(role.id);
            const busy = busyRole !== null;

            return (
              <div
                key={role.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-subtle bg-white/[0.02] p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{role.name}</strong>

                    {assigned && (
                      <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-xs text-violet-200">
                        {t('adminUsers.assigned')}
                      </span>
                    )}

                    <span className="text-xs text-text-secondary">
                      {t('adminUsers.roleUsersCount', {
                        count: role._count.users,
                      })}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {role.permissions.length === 0 ? (
                      <span className="text-xs text-text-secondary">
                        {t('adminUsers.noPermissions')}
                      </span>
                    ) : (
                      role.permissions.map((permission) => (
                        <span
                          key={permission.id}
                          className="rounded-md border border-border-subtle px-2 py-1 font-mono text-xs text-text-secondary"
                        >
                          {permission.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (assigned) {
                      requestRoleRemoval(role);
                    } else {
                      void changeRole(role, false);
                    }
                  }}
                  className={
                    assigned
                      ? 'rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-40'
                      : 'rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40'
                  }
                >
                  {busyRole === role.id
                    ? t('adminUsers.saving')
                    : assigned
                      ? t('adminUsers.removeRole')
                      : t('adminUsers.assignRole')}
                </button>
              </div>
            );
          })}

          <p className="text-xs text-text-secondary">
            {t('adminUsers.rolesSecurityHint')}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={pendingRoleRemoval !== null}
        destructive
        busy={busyRole !== null}
        title={t('adminUsers.removeRoleTitle')}
        description={t('adminUsers.confirmRemoveRole', {
          role: pendingRoleRemoval?.name ?? '',
          username: user.username,
        })}
        confirmLabel={t('adminUsers.removeRole')}
        onCancel={cancelRoleRemoval}
        onConfirm={() => {
          if (pendingRoleRemoval) {
            void changeRole(pendingRoleRemoval, true);
          }
        }}
      />
    </SurfaceCard>
  );
};
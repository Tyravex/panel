import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAdminUser } from '@/features/admin-users/api/admin-users.api';
import { RoleManagementPanel } from '@/features/admin-users/components/RoleManagementPanel';
import type { AdminUser } from '@shared/types';

export const AdminUserRolesPage = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const userId =
    id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))
      ? Number(id)
      : null;

  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (userId === null) {
        setUser(null);
        setError(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(false);

      try {
        const result = await getAdminUser(userId, signal);

        if (!signal?.aborted) {
          setUser(result);
        }
      } catch {
        if (!signal?.aborted) {
          setUser(null);
          setError(true);
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          to={userId === null ? '/admin/users' : `/admin/users/${userId}`}
          className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-primary"
        >
          <span aria-hidden="true">←</span>
          {t('adminUsers.backToUserDetails')}
        </Link>

        <div>
          <h1 className="text-3xl font-bold">
            {t('adminUsers.manageRoles')}
          </h1>

          {user && (
            <p className="mt-2 text-sm text-text-secondary">
              {user.username} · {user.email}
            </p>
          )}
        </div>
      </header>

      {loading && (
        <p role="status" className="text-text-secondary">
          {t('adminUsers.loading')}
        </p>
      )}

      {!loading && error && (
        <p role="alert" className="text-red-400">
          {t('adminUsers.userLoadError')}
        </p>
      )}

      {!loading && user && (
        <RoleManagementPanel
          key={user.id}
          user={user}

          onChanged={() => void load()}
        />
      )}
    </div>
  );
};

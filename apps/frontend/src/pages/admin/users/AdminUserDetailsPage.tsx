import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/app/store/auth.store';
import { getAdminUser } from '@/features/admin-users/api/admin-users.api';
import { AdminUserServices } from '@/features/admin-users/components/AdminUserServices';
import { AdminUsersBackLink } from '@/features/admin-users/components/AdminUsersBackLink';
import { SurfaceCard } from '@/shared/ui/SurfaceCard';
import type { AdminUser } from '@shared/types';

export const AdminUserDetailsPage = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const me = useAuthStore((state) => state.user);

  const canManage = !!me?.permissions?.includes('user:manage');
  const canManageRoles = !!me?.permissions?.includes('role:manage');

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
      <header className="space-y-4">
        <AdminUsersBackLink />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border-subtle bg-primary/10 text-xl font-bold text-primary"
            >
              {user?.username?.charAt(0).toUpperCase() ?? '?'}
            </div>

            <div className="min-w-0">
              <h1 className="break-words text-3xl font-bold">
                {user?.username ?? t('adminUsers.userDetails')}
              </h1>

              {user && (
                <p className="mt-1 break-all text-sm text-text-secondary">
                  {user.email}
                </p>
              )}
            </div>
          </div>

          {user && (
            <div className="flex flex-wrap items-center gap-3">
              {canManageRoles && (
                <Link
                  to={`/admin/users/${user.id}/roles`}
                  className="rounded-xl border border-border-subtle px-5 py-2.5 text-sm font-semibold transition hover:bg-white/5"
                >
                  {t('adminUsers.manageRoles')}
                </Link>
              )}

              {canManage && (
                <Link
                  to={`/admin/users/${user.id}/edit`}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  {t('adminUsers.editUser')}
                </Link>
              )}
            </div>
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
        <>
          <SurfaceCard>
            <h2 className="mb-5 text-xl font-semibold">
              {t('adminUsers.identitySection')}
            </h2>

            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-text-secondary">
                  {t('adminUsers.username')}
                </dt>
                <dd className="mt-1 break-words font-medium">
                  {user.username}
                </dd>
              </div>

              <div>
                <dt className="text-sm text-text-secondary">
                  {t('adminUsers.email')}
                </dt>
                <dd className="mt-1 break-all font-medium">
                  {user.email}
                </dd>
              </div>

              <div>
                <dt className="text-sm text-text-secondary">
                  {t('adminUsers.firstName')}
                </dt>
                <dd className="mt-1 font-medium">
                  {user.firstName || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-sm text-text-secondary">
                  {t('adminUsers.lastName')}
                </dt>
                <dd className="mt-1 font-medium">
                  {user.lastName || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-sm text-text-secondary">
                  {t('adminUsers.accountStatus')}
                </dt>
                <dd className="mt-2">
                  <span
                    className={
                      user.isActive
                        ? 'inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300'
                        : 'inline-flex rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-300'
                    }
                  >
                    {t(
                      user.isActive
                        ? 'adminUsers.active'
                        : 'adminUsers.disabled',
                    )}
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-sm text-text-secondary">
                  {t('adminUsers.preferredLanguage')}
                </dt>
                <dd className="mt-1 font-medium">
                  {user.language === 'pl'
                    ? t('adminUsers.languagePolish')
                    : user.language === 'en'
                      ? t('adminUsers.languageEnglish')
                      : user.language || '—'}
                </dd>
              </div>
            </dl>
          </SurfaceCard>

          <section aria-label={t('adminUsers.rolesPermissionsSection')}>
            <h2 className="mb-4 text-xl font-semibold">
              {t('adminUsers.rolesPermissionsSection')}
            </h2>

            <SurfaceCard>
              {user.roles.length ? (
                <div className="flex flex-wrap gap-2">
                  {user.roles.map((entry) => (
                    <span
                      key={entry.role.id}
                      className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-sm font-medium text-violet-200"
                    >
                      {entry.role.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">
                  {t('adminUsers.noRolesAssigned')}
                </p>
              )}
            </SurfaceCard>
          </section>

<AdminUserServices userId={user.id} />
        </>
      )}
    </div>
  );
};

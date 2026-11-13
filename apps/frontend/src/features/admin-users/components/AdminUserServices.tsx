import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAdminUserServices } from '@/features/admin-users/api/admin-users.api';
import type { AdminUserService } from '@/features/admin-users/api/admin-users.api';
import { SurfaceCard } from '@/shared/ui/SurfaceCard';

type Props = {
  userId: number;
};

export const AdminUserServices = ({ userId }: Props) => {
  const { t } = useTranslation();
  const [services, setServices] = useState<AdminUserService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();

    setServices([]);
    setServicesLoading(true);
    setServicesError(false);

    void getAdminUserServices(userId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setServices(result);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setServices([]);
          setServicesError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setServicesLoading(false);
        }
      });

    return () => controller.abort();
  }, [userId]);
  return (
    <SurfaceCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {t('adminUsers.resourcesSection')}
        </h2>

        {!servicesLoading && !servicesError && (
          <span className="rounded-full border border-border-subtle bg-white/[0.04] px-3 py-1 text-sm font-semibold">
            {services.length}
          </span>
        )}
      </div>

      {servicesLoading && (
        <p role="status" className="mt-5 text-sm text-text-secondary">
          {t('adminUsers.servicesLoading')}
        </p>
      )}

      {!servicesLoading && servicesError && (
        <p role="alert" className="mt-5 text-sm text-red-400">
          {t('adminUsers.servicesLoadError')}
        </p>
      )}

      {!servicesLoading && !servicesError && services.length === 0 && (
        <p className="mt-5 text-sm text-text-secondary">
          {t('adminUsers.noServices')}
        </p>
      )}

      {!servicesLoading && !servicesError && services.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-text-secondary">
                <th scope="col" className="px-3 py-3 font-medium">
                  {t('adminUsers.serviceName')}
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  {t('adminUsers.serviceId')}
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  {t('adminUsers.serviceAccess')}
                </th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr
                  key={service.id}
                  className="border-b border-border-subtle last:border-0"
                >
                  <td className="px-3 py-3 font-medium">
                    {service.name}
                  </td>
                  <td className="px-3 py-3">
                    <code className="break-all text-xs text-text-secondary">
                      {service.id}
                    </code>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={
                        service.access === 'Owner'
                          ? 'inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300'
                          : 'inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-200'
                      }
                    >
                      {t(
                        service.access === 'Owner'
                          ? 'adminUsers.serviceOwner'
                          : 'adminUsers.serviceMember',
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SurfaceCard>
  );
};

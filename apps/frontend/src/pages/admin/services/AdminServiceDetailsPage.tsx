import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/app/store/auth.store';
import { AdminServiceHeader } from '@/features/services/components/AdminServiceHeader';
import { useAdminService } from '@/features/services/hooks/useAdminService';
import { ServiceStatus } from '@/features/services/components/ServiceStatus';

export const AdminServiceDetailsPage = () => {
  const { id } = useParams(); const { t } = useTranslation();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const { service, loading, error } = useAdminService(id);
  return <div className="space-y-6"><AdminServiceHeader title={service?.name ?? t('adminServices.details')} id={id} />
    {loading && <p role="status">{t('common.loading')}</p>}{error && <p role="alert">{error}</p>}
    {service && <>
      <div className="flex flex-wrap gap-3">
        {permissions?.includes('service:manage:any') && service.installStatus === 'DRAFT' && <Link className="rounded-xl bg-primary px-4 py-2 text-white" to={`/admin/services/${id}/edit`}>{t('common.edit')}</Link>}
        {permissions?.includes('service:transfer:any') && permissions.includes('user:read') && <Link className="rounded-xl border border-border-subtle px-4 py-2" to={`/admin/services/${id}/owner`}>{t('adminServices.changeOwner')}</Link>}
        {permissions?.includes('service:manage:any') && ['DRAFT', 'FAILED'].includes(service.installStatus) && <Link className="rounded-xl border border-border-subtle px-4 py-2" to={`/admin/services/${id}/environment`}>{t('adminServices.environment')}</Link>}
      </div>
      <dl className="grid gap-5 rounded-2xl border border-border-subtle bg-surface p-6 sm:grid-cols-2">
        {[[t('adminServices.category'), t(`adminServices.categories.${service.category.key}`)],
        [t('adminServices.columns.status'), <ServiceStatus key="status" kind="installation" status={service.installStatus} />], [t('adminServices.columns.owner'), service.user?.username ?? t('adminServices.unassigned')],
        [t('adminServices.columns.node'), service.nodeId ?? t('adminServices.unassigned')], ['Egg', service.egg ? `${service.egg.name} — ${service.egg.version}` : t('adminServices.noEgg')],
        [t('adminServices.resources.memoryMb'), service.memoryMb], [t('adminServices.resources.cpuPercent'), service.cpuPercent], [t('adminServices.resources.diskMb'), service.diskMb],
        [t('adminServices.eggProfile'), service.eggConfiguration?.profileId ?? '—'], [t('adminServices.runtimeVersion'), service.eggConfiguration?.runtimeVersion ?? '—'],
        ].map(([label, value]) => <div key={String(label)}><dt className="text-sm text-text-secondary">{label}</dt><dd className="mt-1 break-all font-medium">{value ?? '—'}</dd></div>)}
      </dl>
    </>}
  </div>;
};

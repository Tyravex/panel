import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminServiceHeader } from '@/features/services/components/AdminServiceHeader';
import { ServiceEnvironmentEditor } from '@/features/services/components/ServiceEnvironmentEditor';
import { useAdminService } from '@/features/services/hooks/useAdminService';

export const AdminServiceEnvironmentPage = () => {
  const { id } = useParams(); const { t } = useTranslation(); const { service, loading, error } = useAdminService(id);
  return <div className="space-y-6"><AdminServiceHeader id={id} title={t('adminServices.environment')} />
    {loading && <p role="status">{t('common.loading')}</p>}{error && <p role="alert">{error}</p>}
    {service && (['DRAFT', 'FAILED'].includes(service.installStatus) ? <ServiceEnvironmentEditor key={service.id} service={service} /> : <p>{t('adminServices.draftOnly')}</p>)}
  </div>;
};

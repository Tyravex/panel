import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminServiceHeader } from '@/features/services/components/AdminServiceHeader';
import { AdminServiceEditor } from '@/features/services/components/AdminServiceEditor';
import { useAdminService } from '@/features/services/hooks/useAdminService';

export const AdminServiceEditPage = () => {
  const { id } = useParams(); const { t } = useTranslation();
  const { service, loading, error } = useAdminService(id);
  return <div className="space-y-6"><AdminServiceHeader title={t('adminServices.editTitle')} id={id} />
    {loading && <p role="status">{t('common.loading')}</p>}{error && <p role="alert">{error}</p>}
    {service && (service.installStatus === 'DRAFT' ? <AdminServiceEditor key={service.id} service={service} /> : <p role="alert">{t('adminServices.draftOnly')}</p>)}
  </div>;
};

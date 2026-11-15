import { useTranslation } from 'react-i18next';
import { AdminServiceHeader } from '@/features/services/components/AdminServiceHeader';
import { AdminServiceEditor } from '@/features/services/components/AdminServiceEditor';

export const AdminServiceCreatePage = () => {
  const { t } = useTranslation();
  return <div className="space-y-6"><AdminServiceHeader title={t('adminServices.createTitle')} /><AdminServiceEditor /></div>;
};

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const AdminServiceHeader = ({ title, id }: { title: string; id?: string }) => {
  const { t } = useTranslation();
  return <header className="space-y-3">
    <Link to="/admin/services" className="text-sm text-primary">← {t('adminServices.backToList')}</Link>
    <h1 className="text-3xl font-bold">{title}</h1>
    {id && <nav className="flex flex-wrap gap-3 text-sm">
      <Link to={`/admin/services/${id}`}>{t('adminServices.details')}</Link>
      <Link to={`/admin/services/${id}/installation`}>{t('adminServices.installation')}</Link>
    </nav>}
  </header>;
};

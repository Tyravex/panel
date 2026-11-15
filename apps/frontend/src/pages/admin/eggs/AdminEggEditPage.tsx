import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAdminEgg } from '@/features/eggs/hooks/useAdminEgg';
import { EggManifestEditor } from '@/features/eggs/components/EggManifestEditor';

export const AdminEggEditPage = () => {
  const { id } = useParams(); const { t } = useTranslation(); const { egg, error, loading } = useAdminEgg(id);
  return <div className="space-y-6"><Link to={`/admin/eggs/${id}`}>← {t('eggs.details')}</Link><h1 className="text-3xl font-bold">{t('eggs.edit')}</h1>
    {error && <p role="alert">{error}</p>}{loading && <p role="status">{t('common.loading')}</p>}{egg && <EggManifestEditor key={egg.id} egg={egg} />}
  </div>;
};

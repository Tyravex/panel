import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EggRepositoryForm } from '@/features/eggs/components/EggRepositoryForm';
import { useEggRepository } from '@/features/eggs/hooks/useEggRepository';
export const AdminEggRepositoryEditPage = () => {
  const { id } = useParams(); const { t } = useTranslation(); const { repository, loading, error } = useEggRepository(id);
  return <div className="space-y-6"><Link to={`/admin/eggs/repositories/${id}`}>← {t('eggs.repository')}</Link><h1 className="text-3xl font-bold">{t('eggs.editRepository')}</h1>
    {error && <p role="alert">{error}</p>}{loading && <p role="status">{t('common.loading')}</p>}{repository && <EggRepositoryForm key={repository.id} repository={repository} />}
  </div>;
};

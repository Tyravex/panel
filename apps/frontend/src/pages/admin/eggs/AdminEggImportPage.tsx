import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { EggRepository } from '@shared/types';
import { eggsApi } from '@/features/eggs/api/eggsApi';
import { EggManifestEditor } from '@/features/eggs/components/EggManifestEditor';
import { getApiErrorMessage as roleErrorMessage } from '@/shared/lib/getApiErrorMessage';

export const AdminEggImportPage = () => {
  const { t } = useTranslation(); const [repositories, setRepositories] = useState<EggRepository[] | null>(null); const [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); void eggsApi.repositories(controller.signal).then((result) => { if (!controller.signal.aborted) setRepositories(result); })
    .catch((reason: unknown) => { if (!controller.signal.aborted) setError(roleErrorMessage(reason)); }); return () => controller.abort(); }, []);
  return <div className="space-y-6"><Link to="/admin/eggs">← {t('eggs.library')}</Link><h1 className="text-3xl font-bold">{t('eggs.import')}</h1>
    {error && <p role="alert">{error}</p>}{repositories ? <>
      {!repositories.some((repository) => repository.url.startsWith('https:')) && <p>{t('eggs.emptyRepositories')} <Link className="text-primary" to="/admin/eggs/repositories">{t('eggs.repositories')}</Link></p>}
      <EggManifestEditor repositories={repositories.filter((repository) => repository.url.startsWith('https:'))} />
    </> : !error && <p role="status">{t('common.loading')}</p>}
  </div>;
};

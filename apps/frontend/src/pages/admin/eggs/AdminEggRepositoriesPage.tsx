import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { EggRepository } from '@shared/types';
import { useAuthStore } from '@/app/store/auth.store';
import { eggsApi } from '@/features/eggs/api/eggsApi';
import { EggsNavigation } from '@/features/eggs/components/EggsNavigation';
import { getApiErrorMessage as roleErrorMessage } from '@/shared/lib/getApiErrorMessage';

export const AdminEggRepositoriesPage = () => {
  const { t } = useTranslation(); const canManage = useAuthStore((state) => !!state.user?.permissions?.includes('egg-repository:manage'));
  const [rows, setRows] = useState<EggRepository[] | null>(null); const [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); void eggsApi.repositories(controller.signal).then((data) => { if (!controller.signal.aborted) setRows(data); })
    .catch((reason: unknown) => { if (!controller.signal.aborted) setError(roleErrorMessage(reason)); }); return () => controller.abort(); }, []);
  return <div className="space-y-6"><h1 className="text-3xl font-bold">{t('eggs.repositories')}</h1><EggsNavigation />
    {canManage && <Link to="/admin/eggs/repositories/new" className="inline-flex rounded-xl bg-primary px-5 py-3 text-white">{t('eggs.addRepository')}</Link>}
    {error && <p role="alert">{error}</p>}{!rows && !error && <p role="status">{t('common.loading')}</p>}
    <div className="space-y-3">{rows?.map((row) => <Link key={row.id} to={`/admin/eggs/repositories/${row.id}`} className="block rounded-2xl border border-border-subtle bg-surface p-5">
      <h2 className="font-semibold">{row.name} {row.isOfficial && <span className="ml-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-1 text-xs text-blue-300">{t('eggs.officialRepository')}</span>}</h2><p className="mt-2 break-all text-sm text-text-secondary">{row.url}</p><p className="mt-2 text-xs">{t(`eggs.status.${row.status}`)} · {row._count?.eggs ?? 0} Eggs</p>
    </Link>)}</div>{rows?.length === 0 && <p>{t('eggs.emptyRepositories')}</p>}
  </div>;
};

import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/app/store/auth.store';
import { eggsApi } from '@/features/eggs/api/eggsApi';
import { useEggRepository } from '@/features/eggs/hooks/useEggRepository';
import { EggRepositoryCatalog } from '@/features/eggs/components/EggRepositoryCatalog';
import { getApiErrorMessage as roleErrorMessage } from '@/shared/lib/getApiErrorMessage';

export const AdminEggRepositoryDetailsPage = () => {
  const { id } = useParams(); const { t } = useTranslation(); const { repository, error, loading, refresh } = useEggRepository(id);
  const permissions = useAuthStore((state) => state.user?.permissions); const [busy, setBusy] = useState(false); const [actionError, setError] = useState('');
  const navigate = useNavigate();
  const archive = async () => { if (!repository || busy || repository.isOfficial || !window.confirm(t('eggs.confirmArchive'))) return;
    setBusy(true); setError(''); try { await eggsApi.archiveRepository(repository.id); navigate('/admin/eggs/repositories'); } catch (reason) { setError(roleErrorMessage(reason)); } finally { setBusy(false); }
  };
  const toggle = async () => { if (!repository || busy || !window.confirm(t('eggs.confirmAction'))) return; setBusy(true); setError('');
    try { await eggsApi.repositoryStatus(repository.id, repository.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'); refresh(); }
    catch (reason) { setError(roleErrorMessage(reason)); } finally { setBusy(false); } };
  return <div className="space-y-6"><Link to="/admin/eggs/repositories">← {t('eggs.repositories')}</Link><h1 className="text-3xl font-bold">{repository?.name ?? t('eggs.repository')}</h1>
    {(error || actionError) && <p role="alert">{error || actionError}</p>}{loading && <p role="status">{t('common.loading')}</p>}
    {repository && <><p className="break-all text-text-secondary">{repository.url}</p><p>{t(`eggs.status.${repository.status}`)}</p>
      {repository.isOfficial && <span className="inline-flex rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-sm text-blue-300">{t('eggs.officialRepository')}</span>}
      {permissions?.includes('egg-repository:manage') && <div className="flex gap-4"><Link to={`/admin/eggs/repositories/${id}/edit`}>{t('common.edit')}</Link><button disabled={busy} onClick={() => void toggle()}>{t(repository.status === 'ENABLED' ? 'eggs.disable' : 'eggs.enable')}</button></div>}
      {permissions?.includes('egg-repository:manage') && !repository.isOfficial && <button disabled={busy} className="text-amber-300" onClick={() => void archive()}>{t('eggs.archiveRepository')}</button>}
      {permissions?.includes('egg-repository:sync') && repository.url.startsWith('https:') && <EggRepositoryCatalog key={`${id}-${repository.status}`} repositoryId={repository.id} enabled={repository.status === 'ENABLED'} />}
    </>}
  </div>;
};

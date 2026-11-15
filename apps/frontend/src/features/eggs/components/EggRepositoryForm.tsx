import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { EggRepository } from '@shared/types';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';
import { eggsApi } from '../api/eggsApi';
import { getApiErrorMessage as roleErrorMessage } from '@/shared/lib/getApiErrorMessage';

export const EggRepositoryForm = ({ repository }: { repository?: EggRepository }) => {
  const { t } = useTranslation(); const navigate = useNavigate(); const [name, setName] = useState(repository?.name ?? ''); const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const guard = useUnsavedChanges(name !== (repository?.name ?? '') || url !== '');
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const id = repository ? (await eggsApi.renameRepository(repository.id, name.trim()), repository.id) : (await eggsApi.addRepository(name.trim(), url.trim())).id;
      guard.markSaved(); navigate(`/admin/eggs/repositories/${id}`);
    } catch (reason) { setError(roleErrorMessage(reason)); } finally { setBusy(false); }
  };
  return <form className="space-y-5 rounded-2xl border border-border-subtle bg-surface p-6" onSubmit={(event) => void save(event)}>
    {error && <p role="alert">{error}</p>}
    <fieldset className="space-y-5" disabled={busy}>
      <label className="block space-y-2"><span>{t('eggs.name')}</span><input required minLength={1} maxLength={100} className="w-full rounded-xl border border-border-subtle bg-surface p-3" value={name} onChange={(event) => setName(event.target.value)} /></label>
      {repository ? <p className="break-all text-sm">{repository.url}</p> : <label className="block space-y-2"><span>{t('eggs.repositoryUrl')}</span><input type="url" required className="w-full rounded-xl border border-border-subtle bg-surface p-3" value={url} onChange={(event) => setUrl(event.target.value)} /></label>}
      <p className="text-sm text-text-secondary">{t('eggs.repositoryFormat')}</p>
      <pre className="overflow-x-auto rounded-xl bg-background p-4 text-xs">{JSON.stringify({ format: 'tyravex-egg-repository', schemaVersion: 1, eggs: ['eggs/example.json'] }, null, 2)}</pre>
      <button className="rounded-xl bg-primary px-5 py-3 text-white">{t('common.save')}</button>
    </fieldset>
  </form>;
};

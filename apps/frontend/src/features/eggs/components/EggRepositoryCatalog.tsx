import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EggRepositoryPreview } from '@shared/types';
import { eggsApi } from '../api/eggsApi';
import { getApiErrorMessage as roleErrorMessage } from '@/shared/lib/getApiErrorMessage';
import { useAuthStore } from '@/app/store/auth.store';

export const EggRepositoryCatalog = ({ repositoryId, enabled }: { repositoryId: string; enabled: boolean }) => {
  const { t } = useTranslation(); const permissions = useAuthStore((state) => state.user?.permissions);
  const [preview, setPreview] = useState<EggRepositoryPreview | null>(null); const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const load = async () => {
    if (busy || !enabled) return; setBusy(true); setError(''); setNotice('');
    try { setPreview(await eggsApi.preview(repositoryId)); setSelected([]); } catch (reason) { setError(roleErrorMessage(reason)); } finally { setBusy(false); }
  };
  const sync = async () => {
    if (busy || !selected.length || !permissions?.includes('egg:import')) return;
    if (!window.confirm(t('eggs.confirmSync', { count: selected.length }))) return;
    setBusy(true); setError('');
    try { if (!preview) return; const result = await eggsApi.sync(repositoryId, selected, preview.digest); setNotice(t('eggs.syncResult', result)); setPreview(null); setSelected([]); }
    catch (reason) { setError(roleErrorMessage(reason)); } finally { setBusy(false); }
  };
  return <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-6"><h2 className="text-xl font-semibold">{t('eggs.catalog')}</h2>
    <p className="text-sm text-text-secondary">{t('eggs.syncNote')}</p>{!enabled && <p>{t('eggs.enableRepositoryFirst')}</p>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <button disabled={busy || !enabled} onClick={() => void load()} className="rounded-xl border border-border-subtle px-4 py-2 disabled:opacity-40">{t(busy ? 'common.loading' : 'eggs.loadCatalog')}</button>
    {preview && <>{preview.commit && <p className="break-all font-mono text-xs">Commit: {preview.commit}</p>}<div className="space-y-2">{preview.entries.map((entry) => <label key={entry.path} className="flex items-start gap-3 rounded-xl border border-border-subtle p-3">
      <input type="checkbox" disabled={busy || entry.state !== 'NEW' || !permissions?.includes('egg:import')} checked={selected.includes(entry.path)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, entry.path] : current.filter((path) => path !== entry.path))} />
      <span className="min-w-0"><strong>{entry.manifest?.name ?? entry.key}</strong> — {entry.version}<span className="block text-xs text-text-secondary">{entry.path} · {t(`eggs.status.${entry.state}`)}</span>
        {entry.state === 'INVALID' && <span className="block text-sm text-red-300">{t('eggs.invalidManifest')}</span>}
        {entry.manifest?.catalog && <span className="block text-sm text-amber-300">{t('eggs.contractV2Required')}</span>}
        {entry.sha256 && <span className="block break-all font-mono text-xs">SHA-256: {entry.sha256}</span>}
      </span>
    </label>)}</div>
      {permissions?.includes('egg:import') && <button disabled={busy || !selected.length} onClick={() => void sync()} className="rounded-xl bg-primary px-5 py-3 text-white disabled:opacity-40">{t('eggs.importSelected')}</button>}
    </>}
  </section>;
};

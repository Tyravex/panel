import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OfficialEggSettings } from '@shared/types';
import { useAuthStore } from '@/app/store/auth.store';
import { getApiErrorMessage } from '@/shared/lib/getApiErrorMessage';
import { eggUpdateSettingsApi } from '../api/eggUpdateSettings.api';

export const EggUpdateSettingsCard = ({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) => {
  const { t } = useTranslation(); const permissions = useAuthStore((state) => state.user?.permissions);
  const canManage = ['settings:manage', 'egg-repository:sync', 'egg:import'].every((permission) => permissions?.includes(permission));
  const canCheck = ['egg:read', 'egg-repository:sync'].every((permission) => permissions?.includes(permission));
  const [settings, setSettings] = useState<OfficialEggSettings | null>(null); const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const dirty = !!settings && enabled !== settings.enabled;
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    const controller = new AbortController();
    void eggUpdateSettingsApi.get(controller.signal).then((value) => { if (!controller.signal.aborted) { setSettings(value); setEnabled(value.enabled); } }).catch((reason) => { if (!controller.signal.aborted) setError(getApiErrorMessage(reason)); });
    return () => controller.abort();
  }, []);
  const save = async () => {
    if (!canManage || busy || !settings) return; setBusy(true); setError(''); setNotice('');
    try { const value = await eggUpdateSettingsApi.update(enabled); setSettings(value); setEnabled(value.enabled); setNotice(t('eggs.settingsSaved')); }
    catch (reason) { setError(getApiErrorMessage(reason)); } finally { setBusy(false); }
  };
  const check = async (id: string) => {
    if (!canCheck || busy || dirty) return; setBusy(true); setError(''); setNotice('');
    try { await eggUpdateSettingsApi.check(id); setSettings(await eggUpdateSettingsApi.get()); setNotice(t('eggs.catalogChecked')); }
    catch (reason) { setError(getApiErrorMessage(reason)); } finally { setBusy(false); }
  };
  return <section className="space-y-5 rounded-2xl border border-border-subtle bg-surface p-6">
    <h2 className="text-xl font-semibold">{t('eggs.automaticUpdates')}</h2><p className="text-sm text-text-secondary">{t('eggs.automaticUpdatesNote')}</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{!settings && !error && <p role="status">{t('common.loading')}</p>}
    <label className="flex items-center gap-3"><input type="checkbox" checked={enabled} disabled={!settings || busy || !canManage} onChange={(event) => setEnabled(event.target.checked)} />{t('eggs.enableAutomaticUpdates')}</label>
    {!canManage && <p className="text-sm text-text-secondary">{t('eggs.updateSettingsPermissions')}</p>}
    <button disabled={!dirty || busy || !canManage} onClick={() => void save()} className="rounded-xl bg-primary px-5 py-3 text-white disabled:opacity-40">{t('common.save')}</button>
    {settings?.repositories.map((repository) => <div className="space-y-2 rounded-xl border border-border-subtle p-4 text-sm" key={repository.id}>
      <h3 className="font-semibold">{repository.name} <span className="text-blue-300">{t('eggs.officialRepository')}</span></h3>
      <p>{t('eggs.lastCheck')}: {repository.lastCheckedAt ? new Date(repository.lastCheckedAt).toLocaleString() : t('eggs.neverChecked')}</p>
      <p>{t('eggs.lastSync')}: {repository.lastSyncAt ? new Date(repository.lastSyncAt).toLocaleString() : t('eggs.neverChecked')}</p>
      {repository.lastSyncError && <p className="text-amber-300">{t('eggs.syncFailed')}</p>}
      {repository.status !== 'ENABLED' && <p className="text-amber-300">{t('eggs.enableRepositoryFirst')}</p>}
      {canCheck && <button disabled={busy || dirty || repository.status !== 'ENABLED'} onClick={() => void check(repository.id)} className="rounded-xl border border-border-subtle px-4 py-2 disabled:opacity-40">{t('eggs.checkUpdates')}</button>}
    </div>)}
    {settings?.repositories.length === 0 && <p>{t('eggs.noOfficialRepository')}</p>}
  </section>;
};

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServiceEnvironmentMetadata } from '@shared/types';
import { adminServicesApi, type AdminService } from '../api/adminServicesApi';
import { getApiErrorMessage } from '@/shared/lib/getApiErrorMessage';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';

export const ServiceEnvironmentEditor = ({ service }: { service: AdminService }) => {
  const { t } = useTranslation();
  const [metadata, setMetadata] = useState<ServiceEnvironmentMetadata | null>(null);
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  const guard = useUnsavedChanges(Object.keys(values).length > 0);
  useEffect(() => { let active = true; void adminServicesApi.environment(service.id).then((value) => { if (active) setMetadata(value); }).catch((reason) => { if (active) setError(getApiErrorMessage(reason)); }); return () => { active = false; }; }, [service.id]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy || !metadata) return; setBusy(true); setError(''); setSaved(false);
    try { await adminServicesApi.saveEnvironment(service.id, values); setValues({}); guard.markSaved(); setMetadata(await adminServicesApi.environment(service.id)); setSaved(true); }
    catch (reason) { setError(getApiErrorMessage(reason)); } finally { setBusy(false); }
  };
  return <form onSubmit={(event) => void save(event)} className="space-y-5 rounded-2xl border border-border-subtle p-6">
    <h2 className="text-xl font-semibold">{t('adminServices.environment')}</h2><p className="text-sm text-text-secondary">{t('adminServices.environmentNote')}</p>
    {error && <p role="alert">{error}</p>}{saved && <p role="status">{t('adminServices.environmentSaved')}</p>}
    {!metadata && !error && <p role="status">{t('common.loading')}</p>}
    <fieldset disabled={busy || !metadata} className="space-y-4">
      {(service.egg?.manifest.variables ?? []).map((variable) => <div key={variable.name} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 space-y-2"><span>{variable.name}{variable.required ? ' *' : ''} · {t(metadata?.configured.includes(variable.name) ? 'adminServices.valueConfigured' : 'adminServices.valueMissing')}</span>
          <input type={variable.secret ? 'password' : 'text'} autoComplete="off" maxLength={8192} className="w-full rounded-xl border border-border-subtle bg-surface p-3" value={values[variable.name] ?? ''}
            onChange={(event) => { setSaved(false); setValues((previous) => ({ ...previous, [variable.name]: event.target.value })); }} />
        </label>
        <button type="button" className="rounded-xl border border-border-subtle px-4 py-3" onClick={() => { setSaved(false); setValues((previous) => ({ ...previous, [variable.name]: null })); }}>{t('adminServices.removeValue')}</button>
        {values[variable.name] === null && <span className="text-sm text-amber-300">{t('adminServices.valueWillBeRemoved')}</span>}
      </div>)}
      <button disabled={!Object.keys(values).length} className="rounded-xl bg-primary px-5 py-3 text-white disabled:opacity-40">{t('common.save')}</button>
    </fieldset>
  </form>;
};

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AdminEgg, EggManifest, EggRepository } from '@shared/types';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';
import { getApiErrorMessage as roleErrorMessage } from '@/shared/lib/getApiErrorMessage';
import { eggsApi } from '../api/eggsApi';

const example: EggManifest = {
  format: 'tyravex-egg', formatVersion: 1, id: 'my-service', name: 'My service', version: '1.0.0',
  category: 'server', runtime: { image: 'alpine:3.21', startup: 'echo configure-startup' }, resources: { memoryMb: 512, cpuPercent: 100, diskMb: 1024 }, variables: []
};

export const EggManifestEditor = ({ egg, repositories = [] }: { egg?: AdminEgg; repositories?: EggRepository[] }) => {
  const { t } = useTranslation(); const navigate = useNavigate();
  const [initial] = useState(() => {
    const manifest = egg ? { ...egg.manifest, version: egg.version.replace(/\d+$/, (patch) => String(Number(patch) + 1)) } : example;
    return JSON.stringify(manifest, null, 2);
  });
  const [raw, setRaw] = useState(initial); const [repository, setRepository] = useState('');
  const [validated, setValidated] = useState<{ raw: string; manifest: EggManifest } | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const guard = useUnsavedChanges(raw !== initial || repository !== '');
  const validate = async () => {
    if (busy) return; setBusy(true); setError(''); setValidated(null);
    try {
      if (new TextEncoder().encode(raw).length > 1024 * 1024) throw new Error(t('eggs.fileTooLarge'));
      const manifest: unknown = JSON.parse(raw); const result = await eggsApi.validate(manifest); setValidated({ raw, manifest: (result?.manifest ?? manifest) as EggManifest });
    } catch (reason) { setError(roleErrorMessage(reason)); } finally { setBusy(false); }
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy || !validated || validated.raw !== raw || (!egg && !repository)) return;
    setBusy(true); setError('');
    try {
      const result = egg ? await eggsApi.version(egg.id, validated.manifest) : await eggsApi.import(repository, validated.manifest);
      guard.markSaved(); navigate(`/admin/eggs/${result.id}`);
    } catch (reason) { setError(roleErrorMessage(reason)); } finally { setBusy(false); }
  };
  return <form onSubmit={(event) => void save(event)} className="space-y-5 rounded-2xl border border-border-subtle bg-surface p-6">
    <p className="text-sm text-text-secondary">{t(egg ? 'eggs.immutableNote' : 'eggs.formatNote')}</p>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <fieldset disabled={busy} className="space-y-4">
      {!egg && <label className="block space-y-2"><span>{t('eggs.repository')}</span><select required className="w-full rounded-xl border border-border-subtle bg-surface p-3" value={repository} onChange={(event) => setRepository(event.target.value)}>
        <option value="">{t('eggs.chooseRepository')}</option>{repositories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>}
      <label className="block space-y-2"><span>{t('eggs.file')}</span><input type="file" accept=".json,application/json" onChange={(event) => {
        const file = event.target.files?.[0]; if (!file) return;
        if (file.size > 1024 * 1024) { setError(t('eggs.fileTooLarge')); return; }
        guard.requestAction(() => { void file.text().then((text) => { setRaw(text); setValidated(null); }).catch((reason: unknown) => setError(roleErrorMessage(reason))); });
      }} /></label>
      <label className="block space-y-2"><span>{t('eggs.manifest')}</span><textarea className="min-h-80 w-full rounded-xl border border-border-subtle bg-background p-4 font-mono text-sm" spellCheck={false} value={raw} onChange={(event) => { setRaw(event.target.value); setValidated(null); }} /></label>
      <button type="button" className="rounded-xl border border-border-subtle px-4 py-2" onClick={() => void validate()}>{t('eggs.validate')}</button>
      {validated && validated.raw === raw && <section className="space-y-2 rounded-xl border border-emerald-400/20 p-4">
        <h2 className="font-semibold">{t('eggs.preview')}</h2><p>{validated.manifest.name} — {validated.manifest.version}</p>
        <p>{validated.manifest.category} · {validated.manifest.runtime.image}</p><p className="break-all font-mono text-sm">{validated.manifest.runtime.startup}</p>
        <p>{validated.manifest.resources.memoryMb} MiB · CPU {validated.manifest.resources.cpuPercent}% · {validated.manifest.resources.diskMb} MiB</p>
      </section>}
      <div className="flex gap-3"><button disabled={!validated || validated.raw !== raw || (!egg && !repository)} className="rounded-xl bg-primary px-5 py-3 text-white disabled:opacity-40">{t(egg ? 'eggs.saveVersion' : 'eggs.import')}</button>
        <button type="button" className="rounded-xl border border-border-subtle px-5 py-3" onClick={() => navigate(egg ? `/admin/eggs/${egg.id}` : '/admin/eggs')}>{t('common.cancel')}</button></div>
    </fieldset>
  </form>;
};

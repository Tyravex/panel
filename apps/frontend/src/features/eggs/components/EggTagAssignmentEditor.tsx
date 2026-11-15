import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EggTag } from '@shared/types';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';
import { getApiErrorMessage } from '@/shared/lib/getApiErrorMessage';
import { eggsApi } from '../api/eggsApi';
import { EggTagBadge } from './EggTagBadge';

export const EggTagAssignmentEditor = ({ eggId, canEdit }: { eggId: string; canEdit: boolean }) => {
  const { t } = useTranslation(); const [available, setAvailable] = useState<EggTag[]>([]); const [assigned, setAssigned] = useState<EggTag[]>([]);
  const [selected, setSelected] = useState<string[]>([]); const [baseline, setBaseline] = useState('[]'); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const dirty = JSON.stringify([...selected].sort()) !== baseline;
  const guard = useUnsavedChanges(dirty);
  useEffect(() => {
    let active = true; void Promise.all([eggsApi.tags(), eggsApi.eggTags(eggId)]).then(([tags, values]) => {
      if (!active) return; setAvailable(tags.filter((tag) => !tag.system)); setAssigned(values); const ids = values.filter((tag) => !tag.system).map((tag) => tag.id); setSelected(ids); setBaseline(JSON.stringify(ids.sort()));
    }).catch((reason) => { if (active) setError(getApiErrorMessage(reason)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; };
  }, [eggId]);
  const save = async () => {
    if (busy || !canEdit || loading) return; setBusy(true); setError('');
    try { await eggsApi.assignTags(eggId, selected); setBaseline(JSON.stringify([...selected].sort())); guard.markSaved(); }
    catch (reason) { setError(getApiErrorMessage(reason)); } finally { setBusy(false); }
  };
  return <section className="space-y-4 rounded-2xl border border-border-subtle p-5"><h2 className="text-lg font-semibold">{t('eggs.tags')}</h2>{error && <p role="alert">{error}</p>}
    {loading && <p role="status">{t('common.loading')}</p>}<div className="flex flex-wrap gap-2">{assigned.filter((tag) => tag.system).map((tag) => <EggTagBadge key={tag.id} tag={tag} />)}</div>
    <fieldset disabled={!canEdit || busy || loading} className="flex flex-wrap gap-3">{available.map((tag) => <label className="flex items-center gap-2" key={tag.id}><input type="checkbox" checked={selected.includes(tag.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, tag.id] : current.filter((id) => id !== tag.id))} /><EggTagBadge tag={tag} /></label>)}</fieldset>
    {canEdit && <button disabled={!dirty || busy || loading} className="rounded-xl bg-primary px-4 py-2 text-white disabled:opacity-40" onClick={() => void save()}>{t('common.save')}</button>}
  </section>;
};

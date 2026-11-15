import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { eggsApi } from '../api/eggsApi';
import { EggTagAssignmentEditor } from './EggTagAssignmentEditor';
import { getApiErrorMessage } from '@/shared/lib/getApiErrorMessage';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';

export const PersonalEggTags = () => {
  const { t } = useTranslation(); const [eggs, setEggs] = useState<{ id: string; name: string; version: string }[]>([]); const [selected, setSelected] = useState(''); const [error, setError] = useState('');
  const guard = useUnsavedChanges(false);
  useEffect(() => { let active = true; void eggsApi.mine().then((rows) => { if (active) setEggs(rows); }).catch((reason) => { if (active) setError(getApiErrorMessage(reason)); }); return () => { active = false; }; }, []);
  return <section className="space-y-4"><h2 className="text-xl font-semibold">{t('eggs.myEggTags')}</h2>{error && <p role="alert">{error}</p>}
    <label className="block space-y-2"><span>{t('eggs.chooseEgg')}</span><select className="w-full rounded-xl border border-border-subtle bg-surface p-3" value={selected} onChange={(event) => { const id = event.target.value; guard.requestAction(() => setSelected(id)); }}>
      <option value="">{t('eggs.chooseEgg')}</option>{eggs.map((egg) => <option key={egg.id} value={egg.id}>{egg.name} · {egg.version}</option>)}
    </select></label>{selected && <EggTagAssignmentEditor key={selected} eggId={selected} canEdit />}
  </section>;
};

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { EGG_TAG_COLORS, type EggTag, type EggTagColor } from '@shared/types';
import { useAuthStore } from '@/app/store/auth.store';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';
import { getApiErrorMessage } from '@/shared/lib/getApiErrorMessage';
import { eggsApi } from '../api/eggsApi';
import { EggTagBadge } from './EggTagBadge';

export const EggTagManager = () => {
  const { t } = useTranslation(); const user = useAuthStore((state) => state.user);
  const canManage = !!user?.permissions?.includes('egg:manage');
  const [tags, setTags] = useState<EggTag[]>([]); const [name, setName] = useState(''); const [color, setColor] = useState<EggTagColor>('violet'); const [shared, setShared] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EggTag | null>(null);
  const guard = useUnsavedChanges(name !== (editing?.name ?? '') || color !== (editing?.color ?? 'violet') || shared !== (editing ? editing.ownerId === null : false));
  const reset = () => { setEditing(null); setName(''); setColor('violet'); setShared(false); };
  useEffect(() => { let active = true; void eggsApi.tags().then((rows) => { if (active) setTags(rows); }).catch((reason) => { if (active) setError(getApiErrorMessage(reason)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy || !name.trim()) return; setBusy(true); setError('');
    try { const tag = editing ? await eggsApi.updateTag(editing.id, name.trim(), color) : await eggsApi.createTag(name.trim(), color, shared && canManage); setTags((current) => editing ? current.map((item) => item.id === tag.id ? tag : item) : [...current, tag]); reset(); guard.markSaved(); }
    catch (reason) { setError(getApiErrorMessage(reason)); } finally { setBusy(false); }
  };
  const remove = async (tag: EggTag) => {
    if (busy || !window.confirm(t('eggs.confirmRemoveTag', { name: tag.name }))) return; setBusy(true); setError('');
    try { await eggsApi.removeTag(tag.id); setTags((current) => current.filter((item) => item.id !== tag.id)); if (editing?.id === tag.id) { reset(); guard.markSaved(); } }
    catch (reason) { setError(getApiErrorMessage(reason)); } finally { setBusy(false); }
  };
  return <div className="space-y-6"><p className="text-sm text-text-secondary">{t('eggs.tagsNote')}</p>{error && <p role="alert">{error}</p>}
    <form className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-6" onSubmit={(event) => void create(event)}><h2 className="text-xl font-semibold">{t(editing ? 'eggs.editTag' : 'eggs.createTag')}</h2>
      <fieldset disabled={busy || loading} className="flex flex-wrap items-end gap-4">
        <label className="flex-1 space-y-2"><span>{t('eggs.name')}</span><input required maxLength={40} className="w-full rounded-xl border border-border-subtle bg-background p-3" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="space-y-2"><span>{t('eggs.tagColor')}</span><select className="block rounded-xl border border-border-subtle bg-background p-3" value={color} onChange={(event) => setColor(event.target.value as EggTagColor)}>{EGG_TAG_COLORS.map((key) => <option key={key} value={key}>{t(`eggs.colors.${key}`)}</option>)}</select></label>
        {canManage && !editing && <label className="flex items-center gap-2 py-3"><input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} />{t('eggs.sharedTag')}</label>}
        <button className="rounded-xl bg-primary px-5 py-3 text-white disabled:opacity-40" disabled={!name.trim()}>{t('common.save')}</button>
        {editing && <button type="button" onClick={() => guard.requestAction(reset)}>{t('common.cancel')}</button>}
      </fieldset>
    </form>
    {loading && <p role="status">{t('common.loading')}</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tags.map((tag) => <div key={tag.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle p-4">
      <EggTagBadge tag={tag} />{!tag.system && (tag.ownerId === user?.id || (tag.ownerId === null && canManage)) && <div className="flex gap-3"><button disabled={busy} onClick={() => guard.requestAction(() => { setEditing(tag); setName(tag.name); setColor(tag.color); setShared(tag.ownerId === null); })}>{t('common.edit')}</button><button disabled={busy} onClick={() => void remove(tag)}>{t('common.delete')}</button></div>}
    </div>)}</div>
  </div>;
};

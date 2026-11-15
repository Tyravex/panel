import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/app/store/auth.store';
import { eggsApi, type EggPage } from '@/features/eggs/api/eggsApi';
import { EggsNavigation } from '@/features/eggs/components/EggsNavigation';
import { getApiErrorMessage as roleErrorMessage } from '@/shared/lib/getApiErrorMessage';
import type { EggTag } from '@shared/types';
import { AdminEggsTable } from '@/features/eggs/components/AdminEggsTable';
import { EggCatalogUpdateCheck } from '@/features/eggs/components/EggCatalogUpdateCheck';

export const AdminEggsPage = () => {
  const { t } = useTranslation(); const canImport = useAuthStore((state) => !!state.user?.permissions?.includes('egg:import'));
  const canManage = useAuthStore((state) => !!state.user?.permissions?.includes('egg:manage'));
  const canCheck = useAuthStore((state) => !!state.user?.permissions?.includes('egg-repository:sync'));
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState(''); const [page, setPage] = useState(1); const [data, setData] = useState<EggPage | null>(null); const [error, setError] = useState('');
  const [category, setCategory] = useState(''); const [tag, setTag] = useState(''); const [tags, setTags] = useState<EggTag[]>([]);
  useEffect(() => { const controller = new AbortController(); void eggsApi.tags(controller.signal).then(setTags).catch((reason) => { if (!controller.signal.aborted) setError(roleErrorMessage(reason)); }); return () => controller.abort(); }, []);
  useEffect(() => { const controller = new AbortController(); setData(null); setError('');
    const timer = window.setTimeout(() => void eggsApi.list(query, page, controller.signal, { ...(category ? { category } : {}), ...(tag ? { tag } : {}) }).then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(roleErrorMessage(reason)); }), 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, page, category, tag, revision]);
  return <div className="space-y-6"><h1 className="text-3xl font-bold">{t('eggs.library')}</h1><EggsNavigation />
    <div className="flex flex-wrap gap-3"><label className="flex-1"><span className="sr-only">{t('common.search')}</span><input maxLength={100} className="w-full rounded-xl border border-border-subtle bg-surface p-3" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t('common.search')} /></label>
      <label><span className="sr-only">{t('adminServices.category')}</span><select className="rounded-xl border border-border-subtle bg-surface p-3" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
        <option value="">{t('adminServices.allCategories')}</option>{['server', 'discord_bot', 'telegram_bot', 'other'].map((key) => <option key={key} value={key}>{t(`adminServices.categories.${key}`)}</option>)}
      </select></label>
      <label><span className="sr-only">{t('eggs.tags')}</span><select className="rounded-xl border border-border-subtle bg-surface p-3" value={tag} onChange={(event) => { setTag(event.target.value); setPage(1); }}>
        <option value="">{t('eggs.allTags')}</option>{tags.map((item) => <option key={item.id} value={item.id}>{item.system ? t(`eggs.systemTags.${item.id.slice(7)}`, { defaultValue: item.name }) : item.name}</option>)}
      </select></label>
      {canCheck && <EggCatalogUpdateCheck onChecked={() => setRevision((value) => value + 1)} />}
      {canImport && <Link className="rounded-xl bg-primary px-5 py-3 text-white" to="/admin/eggs/import">{t('eggs.import')}</Link>}</div>
    {error && <p role="alert">{error}</p>}{!data && !error && <p role="status">{t('common.loading')}</p>}
    {data && <><AdminEggsTable items={data.items} canManage={canManage} />
      <div className="flex items-center gap-4"><button disabled={!data.pagination.hasPreviousPage} onClick={() => setPage((value) => value - 1)}>{t('eggs.previous')}</button><span>{page} / {Math.max(1, data.pagination.totalPages)}</span><button disabled={!data.pagination.hasNextPage} onClick={() => setPage((value) => value + 1)}>{t('eggs.next')}</button></div></>}
  </div>;
};

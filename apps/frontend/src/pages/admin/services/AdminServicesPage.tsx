import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/app/store/auth.store';
import { adminServicesApi, type AdminService } from '@/features/services/api/adminServicesApi';
import { AdminServicesListTable } from '@/features/services/components/AdminServicesListTable';
import { getApiErrorMessage } from '@/shared/lib/getApiErrorMessage';

export const AdminServicesPage = () => {
  const { t } = useTranslation();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const [services, setServices] = useState<AdminService[]>([]);
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void adminServicesApi.list(controller.signal).then((rows) => { if (!controller.signal.aborted) setServices(rows); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(getApiErrorMessage(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const term = query.trim().toLocaleLowerCase();
  const filtered = services.filter((service) => (category === 'all' || service.category.key === category) &&
    [service.name, service.id, service.user?.username ?? ''].some((value) => value.toLocaleLowerCase().includes(term)));
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">{t('adminServices.title')}</h1><p className="mt-2 text-text-secondary">{t('adminServices.description')}</p></div>
      {permissions?.includes('service:create') && <Link className="rounded-xl bg-primary px-5 py-3 text-white" to="/admin/services/new">{t('adminServices.createService')}</Link>}
    </header>
    <div className="flex flex-wrap gap-3"><input aria-label={t('adminServices.searchLabel')} className="flex-1 rounded-xl border border-border-subtle bg-surface p-3" placeholder={t('common.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label={t('adminServices.category')} className="rounded-xl border border-border-subtle bg-surface p-3" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">{t('adminServices.allCategories')}</option>{['server', 'discord_bot', 'telegram_bot', 'other'].map((key) => <option key={key} value={key}>{t(`adminServices.categories.${key}`)}</option>)}</select>
      <button onClick={() => setRevision((value) => value + 1)} disabled={loading} className="rounded-xl border border-border-subtle px-4 py-2">{t('adminServices.refresh')}</button>
    </div>
    {error && <p role="alert">{error}</p>}{loading ? <p role="status">{t('adminServices.loading')}</p> : <AdminServicesListTable services={filtered} canManage={!!permissions?.includes('service:manage:any')} />}
  </div>;
};

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAdminUsers, type AdminUser } from '@/features/admin-users/api/admin-users.api';
import { serviceFieldClass, serviceSelectClass } from '@/features/services/lib/serviceForm';

type Props = { value: number | null; onChange: (value: number | null) => void; disabled?: boolean; currentOwner?: { id: number; username: string } | null };

export const ServiceOwnerPicker = ({ value, onChange, disabled = false, currentOwner }: Props) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  useEffect(() => { setPage(1); }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void getAdminUsers(page, query.trim(), 'active', controller.signal)
        .then((response) => {
          if (controller.signal.aborted) return;
          setUsers(response.items.filter((user) => user.isActive));
          setPages(Math.max(1, response.pages));
          setError(false);
        })
        .catch(() => { if (!controller.signal.aborted) setError(true); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, page]);
  const chosen = users.find((user) => user.id === value) ?? (selected?.id === value ? selected : null);
  const fallback = value !== null && currentOwner?.id === value ? currentOwner.username : null;
  return (
    <div className="space-y-2">
      <input type="search" aria-label={t('adminServices.ownerPicker.searchLabel')} placeholder={t('adminServices.ownerPicker.searchPlaceholder')} value={query} onChange={(event) => setQuery(event.target.value)} disabled={disabled} className={serviceFieldClass} />
      <select aria-label={t('adminServices.ownerPicker.selectLabel')} value={value === null ? '' : String(value)} onChange={(event) => { const id = event.target.value === '' ? null : Number(event.target.value); setSelected(users.find((user) => user.id === id) ?? null); onChange(id); }} disabled={disabled || loading || error} className={serviceSelectClass}>
        <option value="">{t('adminServices.ownerPicker.noOwner')}</option>
        {value !== null && !users.some((user) => user.id === value) && <option value={value}>{chosen ? `${chosen.username} — ${chosen.email}` : fallback ? `${fallback} (#${value})` : t('adminServices.ownerPicker.userId', { id: value })}</option>}
        {users.map((user) => <option key={user.id} value={user.id}>{user.username} — {user.email} (#{user.id})</option>)}
      </select>
      {loading && <p className="text-xs text-text-secondary">{t('adminServices.ownerPicker.loading')}</p>}
      {error && <p role="alert" className="text-sm text-red-400">{t('adminServices.ownerPicker.error')}</p>}
      {!loading && !error && users.length === 0 && <p className="text-xs text-text-secondary">{t('adminServices.ownerPicker.empty')}</p>}
      {!error && pages > 1 && <div className="flex items-center gap-2 text-xs"><button type="button" disabled={disabled || loading || page === 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-border-subtle px-2 py-1 disabled:opacity-50">{t('common.previous')}</button><span>{t('adminServices.ownerPicker.page', { page, pages })}</span><button type="button" disabled={disabled || loading || page >= pages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-border-subtle px-2 py-1 disabled:opacity-50">{t('common.next')}</button></div>}
      {value !== null && <p className="text-xs text-text-secondary">{t('adminServices.ownerPicker.selected', { name: chosen ? `${chosen.username} (${chosen.email})` : fallback ?? `#${value}` })}</p>}
    </div>
  );
};

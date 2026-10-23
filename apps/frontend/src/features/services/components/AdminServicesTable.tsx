import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NodeRecord } from '@/features/nodes/api/nodesApi';
import type { AdminService } from '@/features/services/api/adminServicesApi';
import { ServiceOwnerPicker } from '@/features/services/components/ServiceOwnerPicker';

type Props = { services: AdminService[]; nodes: NodeRecord[]; loading: boolean; busy: boolean; canManage: boolean; onChangeOwner: (id: string, userId: number | null) => Promise<boolean>; onChanged: () => void };

export const AdminServicesTable = ({ services, nodes, loading, busy, canManage, onChangeOwner, onChanged }: Props) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [editingOwner, setEditingOwner] = useState<string | null>(null);
    const [newOwner, setNewOwner] = useState<number | null>(null);
    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return services.filter((service) => [service.name, service.id, service.category?.name ?? '', service.user?.username ?? ''].some((value) => value.toLowerCase().includes(term)));
    }, [services, search]);
    const saveOwner = async (service: AdminService) => {
        if (busy || !canManage) return;
        if (newOwner === service.userId) { setEditingOwner(null); return; }
        if (!window.confirm(t('adminServices.confirmOwner', { name: service.name }))) return;
        if (await onChangeOwner(service.id, newOwner)) { setEditingOwner(null); onChanged(); }
    };
    return (
        <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle p-5"><h2 className="text-lg font-semibold">{t('adminServices.allServices', { count: filtered.length })}</h2><label className="flex items-center gap-2 rounded-xl border border-border-subtle px-3"><Search size={17} aria-hidden="true" /><input aria-label={t('adminServices.searchLabel')} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('common.search')} className="bg-transparent py-2 outline-none" /></label></div>
            {loading ? <p className="p-6 text-text-secondary">{t('adminServices.loading')}</p> : filtered.length === 0 ? <p className="p-6 text-text-secondary">{t('adminServices.empty')}</p> : (
                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border-subtle text-text-secondary"><tr>{(['service', 'category', 'status', 'node', 'owner', 'actions'] as const).map((key) => <th key={key} className="p-4">{t(`adminServices.columns.${key}`)}</th>)}</tr></thead><tbody>
                    {filtered.map((service) => <tr key={service.id} className="border-b border-border-subtle last:border-0"><td className="p-4"><strong>{service.name}</strong><p className="font-mono text-xs text-text-secondary">{service.id}</p></td><td className="p-4">{t(`adminServices.categories.${service.category?.key}`, { defaultValue: service.category?.name ?? '—' })}</td><td className="p-4">{service.installStatus}</td><td className="p-4 font-mono text-xs">{nodes.find((node) => node.id === service.nodeId)?.name ?? service.nodeId ?? '—'}</td><td className="p-4">{service.user ? `${service.user.username} (#${service.user.id})` : service.userId === null ? t('adminServices.unassigned') : `#${service.userId}`}</td><td className="p-4">{canManage && (editingOwner === service.id ? <div className="flex min-w-48 flex-col gap-2"><ServiceOwnerPicker key={service.id} value={newOwner} onChange={setNewOwner} currentOwner={service.user} disabled={busy} /><button type="button" disabled={busy} onClick={() => void saveOwner(service)} className="rounded-lg bg-primary px-3 py-2 text-white disabled:opacity-50">{t('common.save')}</button><button type="button" disabled={busy} onClick={() => setEditingOwner(null)} className="rounded-lg border border-border-subtle px-3 py-2">{t('common.cancel')}</button></div> : <button type="button" disabled={busy} onClick={() => { setEditingOwner(service.id); setNewOwner(service.userId); }} className="rounded-lg border border-border-subtle px-3 py-2 disabled:opacity-50">{t('adminServices.changeOwner')}</button>)}</td></tr>)}
                </tbody></table></div>
            )}
        </section>
    );
};

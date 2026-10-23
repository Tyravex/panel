import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, Search, ServerCog } from 'lucide-react';
import { useAuthStore } from '@/app/store/auth.store';
import { nodesApi, type NodeRecord } from '@/features/nodes/api/nodesApi';
import { adminServicesApi, type AdminService, type CreateAdminService } from '@/features/services/api/adminServicesApi';
import { ServiceOwnerPicker } from '@/features/services/components/ServiceOwnerPicker';

const categories = [
    { key: 'server', name: 'Serwer' },
    { key: 'discord_bot', name: 'Bot Discord' },
    { key: 'telegram_bot', name: 'Bot Telegram' },
    { key: 'other', name: 'Inna usługa' },
];

const fieldClass = 'w-full rounded-xl border border-border-subtle bg-transparent px-4 py-3';
const selectClass = `${fieldClass} bg-surface text-text-primary [color-scheme:dark] [&_option]:bg-[#151a27] [&_option]:text-white`;

function errorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
        const message = response?.data?.message;
        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return message.join(', ');
    }
    return error instanceof Error ? error.message : 'Nie udało się wykonać operacji.';
}

function optionalPositiveInteger(raw: string, label: string): number | undefined {
    if (!raw.trim()) return undefined;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label}: wpisz dodatnią liczbę całkowitą.`);
    return value;
}

export const AdminServicesPage = () => {
    const user = useAuthStore((state) => state.user);
    const canCreate = Boolean(user?.roles?.includes('Owner') && user.permissions.includes('service:create'));
    const canManage = Boolean(user?.roles?.includes('Owner') && user.permissions.includes('service:manage:any'));
    const [services, setServices] = useState<AdminService[]>([]);
    const [nodes, setNodes] = useState<NodeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState('');
    const [categoryKey, setCategoryKey] = useState('server');
    const [ownerId, setOwnerId] = useState<number | null>(null);
    const [nodeId, setNodeId] = useState('');
    const [memoryMb, setMemoryMb] = useState('');
    const [cpuPercent, setCpuPercent] = useState('');
    const [diskMb, setDiskMb] = useState('');
    const [editingOwner, setEditingOwner] = useState<string | null>(null);
    const [newOwner, setNewOwner] = useState<number | null>(null);
    const [refreshIndex, setRefreshIndex] = useState(0);

    const refresh = useCallback(() => setRefreshIndex((value) => value + 1), []);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        Promise.all([adminServicesApi.list(controller.signal), nodesApi.list(controller.signal)])
            .then(([items, availableNodes]) => {
                if (!controller.signal.aborted) {
                    setServices(items);
                    setNodes(availableNodes);
                    setError('');
                }
            })
            .catch((reason: unknown) => {
                if (!controller.signal.aborted) setError(errorMessage(reason));
            })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [refreshIndex]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return services.filter((service) => [service.name, service.id, service.category?.name ?? '', service.user?.username ?? '']
            .some((value) => value.toLowerCase().includes(term)));
    }, [search, services]);

    const create = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (busy || !canCreate) return;
        setError('');
        setNotice('');
        try {
            const payload: CreateAdminService = {
                name: name.trim(), categoryKey,
                userId: ownerId,
                ...(nodeId ? { nodeId } : {}),
                ...(memoryMb.trim() ? { memoryMb: optionalPositiveInteger(memoryMb, 'RAM') } : {}),
                ...(cpuPercent.trim() ? { cpuPercent: optionalPositiveInteger(cpuPercent, 'CPU') } : {}),
                ...(diskMb.trim() ? { diskMb: optionalPositiveInteger(diskMb, 'Dysk') } : {}),
            };
            if (!payload.name || payload.name.length > 100) throw new Error('Nazwa musi mieć od 1 do 100 znaków.');
            setBusy(true);
            await adminServicesApi.create(payload);
            setShowCreate(false);
            setName(''); setOwnerId(null); setNodeId(''); setMemoryMb(''); setCpuPercent(''); setDiskMb('');
            setNotice('Utworzono szkic usługi. Kontener nie został jeszcze uruchomiony.');
            refresh();
        } catch (reason) { setError(errorMessage(reason)); }
        finally { setBusy(false); }
    };

    const changeOwner = async (service: AdminService) => {
        if (busy || !canManage) return;
        setError(''); setNotice('');
        try {
            const nextId = newOwner;
            if (nextId === service.userId) { setEditingOwner(null); return; }
            if (!window.confirm(`Zmienić właściciela usługi „${service.name}”?`)) return;
            setBusy(true);
            await adminServicesApi.setOwner(service.id, nextId);
            setEditingOwner(null);
            setNotice('Właściciel usługi został zaktualizowany.');
            refresh();
        } catch (reason) { setError(errorMessage(reason)); }
        finally { setBusy(false); }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-primary">Administracja</p>
                    <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold"><ServerCog aria-hidden="true" /> Usługi</h1>
                    <p className="mt-2 text-text-secondary">Zarządzaj szkicami usług i ich właścicielami.</p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={refresh} disabled={loading || busy} className="flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2 disabled:opacity-50"><RefreshCw size={17} /> Odśwież</button>
                    {canCreate && <button type="button" onClick={() => setShowCreate((value) => !value)} disabled={busy} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50"><Plus size={17} /> Utwórz usługę</button>}
                </div>
            </header>

            {error && <p role="alert" className="rounded-xl border border-red-500/30 p-4 text-red-300">{error}</p>}
            {notice && <p role="status" className="rounded-xl border border-emerald-500/30 p-4 text-emerald-300">{notice}</p>}

            {showCreate && canCreate && (
                <form onSubmit={(event) => void create(event)} className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-6">
                    <h2 className="text-xl font-semibold">Nowa usługa</h2>
                    <p className="text-sm text-text-secondary">Utworzenie zapisuje tylko szkic (DRAFT). Nie rezerwuje zasobów ani nie uruchamia Dockera.</p>
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2"><span className="block text-sm">Nazwa</span><input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} /></label>
                        <label className="space-y-2"><span className="block text-sm">Kategoria</span><select value={categoryKey} onChange={(event) => setCategoryKey(event.target.value)} className={selectClass}>{categories.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
                        <div className="space-y-2"><span className="block text-sm">Właściciel (opcjonalnie)</span><ServiceOwnerPicker value={ownerId} onChange={setOwnerId} disabled={busy} /></div>
                        <label className="space-y-2"><span className="block text-sm">Node (opcjonalnie)</span><select value={nodeId} onChange={(event) => setNodeId(event.target.value)} className={selectClass}><option value="">Nieprzypisany</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.name} ({node.status})</option>)}</select></label>
                        <label className="space-y-2"><span className="block text-sm">RAM (MB)</span><input type="number" min={1} max={1048576} step={1} value={memoryMb} onChange={(event) => setMemoryMb(event.target.value)} className={fieldClass} /></label>
                        <label className="space-y-2"><span className="block text-sm">CPU (%)</span><input type="number" min={1} max={100000} step={1} value={cpuPercent} onChange={(event) => setCpuPercent(event.target.value)} className={fieldClass} /></label>
                        <label className="space-y-2"><span className="block text-sm">Dysk (MB)</span><input type="number" min={1} max={10485760} step={1} value={diskMb} onChange={(event) => setDiskMb(event.target.value)} className={fieldClass} /></label>
                    </div>
                    <div className="flex gap-3"><button type="submit" disabled={busy} className="rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Zapisywanie...' : 'Utwórz szkic'}</button><button type="button" disabled={busy} onClick={() => setShowCreate(false)} className="rounded-xl border border-border-subtle px-5 py-3">Anuluj</button></div>
                </form>
            )}

            <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle p-5">
                    <h2 className="text-lg font-semibold">Wszystkie usługi ({filtered.length})</h2>
                    <label className="flex items-center gap-2 rounded-xl border border-border-subtle px-3"><Search size={17} aria-hidden="true" /><input aria-label="Szukaj usług" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj..." className="bg-transparent py-2 outline-none" /></label>
                </div>
                {loading ? <p className="p-6 text-text-secondary">Ładowanie usług...</p> : filtered.length === 0 ? <p className="p-6 text-text-secondary">Nie znaleziono usług.</p> : (
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border-subtle text-text-secondary"><tr><th className="p-4">Usługa</th><th className="p-4">Kategoria</th><th className="p-4">Status</th><th className="p-4">Node</th><th className="p-4">Właściciel</th><th className="p-4">Akcje</th></tr></thead><tbody>
                        {filtered.map((service) => <tr key={service.id} className="border-b border-border-subtle last:border-0"><td className="p-4"><strong>{service.name}</strong><p className="font-mono text-xs text-text-secondary">{service.id}</p></td><td className="p-4">{service.category?.name ?? '—'}</td><td className="p-4">{service.installStatus}</td><td className="p-4 font-mono text-xs">{nodes.find((node) => node.id === service.nodeId)?.name ?? service.nodeId ?? '—'}</td><td className="p-4">{service.user ? `${service.user.username} (#${service.user.id})` : service.userId === null ? 'Nieprzypisany' : `#${service.userId}`}</td><td className="p-4">{canManage && (editingOwner === service.id ? <div className="flex min-w-48 flex-col gap-2"><ServiceOwnerPicker key={service.id} value={newOwner} onChange={setNewOwner} currentOwner={service.user} disabled={busy} /><button type="button" disabled={busy} onClick={() => void changeOwner(service)} className="rounded-lg bg-primary px-3 py-2 text-white disabled:opacity-50">Zapisz</button><button type="button" disabled={busy} onClick={() => setEditingOwner(null)} className="rounded-lg border border-border-subtle px-3 py-2">Anuluj</button></div> : <button type="button" disabled={busy} onClick={() => { setEditingOwner(service.id); setNewOwner(service.userId); }} className="rounded-lg border border-border-subtle px-3 py-2 disabled:opacity-50">Zmień właściciela</button>)}</td></tr>)}
                    </tbody></table></div>
                )}
            </section>
        </div>
    );
};

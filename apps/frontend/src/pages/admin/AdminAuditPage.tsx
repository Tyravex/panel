import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from 'lucide-react';
import { api } from '@/shared/api/client';
import { SurfaceCard } from '@/shared/ui/SurfaceCard';

type AuditEntry = {
    id: string;
    actorId: number | null;
    actor: { id: number; username: string } | null;
    action: string;
    targetType: string;
    targetId: string;
    metadata: unknown;
    createdAt: string;
};

type AuditResponse = {
    items: AuditEntry[];
    total: number;
    page: number;
    limit: number;
    pages: number;
};

const actions = [
    'USER_CREATED', 'USER_UPDATED', 'USER_ENABLED', 'USER_DISABLED',
    'ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_DELETED', 'ROLE_ASSIGNED', 'ROLE_REVOKED',
];

const messageOf = (error: unknown) => {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
        const message = response?.data?.message;
        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return message.join(', ');
    }
    return error instanceof Error ? error.message : 'Unable to load audit entries.';
};

export const AdminAuditPage = () => {
    const [page, setPage] = useState(1);
    const [action, setAction] = useState('');
    const [actorInput, setActorInput] = useState('');
    const [actorId, setActorId] = useState('');
    const [data, setData] = useState<AuditResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        const params: Record<string, string | number> = { page };
        if (action) params.action = action;
        if (actorId) params.actorId = actorId;

        api.get<AuditResponse>('/admin/audit', { params, signal: controller.signal })
            .then((response) => {
                if (!controller.signal.aborted) setData(response.data);
            })
            .catch((reason: unknown) => {
                if (!controller.signal.aborted) {
                    setData(null);
                    setError(messageOf(reason));
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [page, action, actorId, refreshKey]);

    const applyActor = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const value = actorInput.trim();
        if (value && (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value)))) {
            setError('Actor ID must be a positive integer.');
            return;
        }
        setError('');
        setPage(1);
        setActorId(value);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-primary">Tyravex / Administration / System</p>
                    <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold tracking-tight">
                        <ClipboardList size={28} aria-hidden="true" /> Audit Logs
                    </h1>
                    <p className="mt-2 text-text-secondary">Review administrator actions and role changes.</p>
                </div>
                <button type="button" onClick={() => setRefreshKey((value) => value + 1)}
                    disabled={loading} className="flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50">
                    <RefreshCw size={16} aria-hidden="true" /> Refresh
                </button>
            </div>

            <SurfaceCard>
                <div className="flex flex-wrap items-end gap-4">
                    <label className="flex min-w-56 flex-col gap-2 text-sm">
                        <span className="font-medium">Action</span>
                        <select value={action} onChange={(event) => { setPage(1); setAction(event.target.value); }}
                            className="rounded-xl border border-border-subtle bg-surface px-4 py-3">
                            <option value="">All actions</option>
                            {actions.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                    </label>
                    <form onSubmit={applyActor} className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col gap-2 text-sm">
                            <span className="font-medium">Actor ID</span>
                            <input inputMode="numeric" value={actorInput} onChange={(event) => setActorInput(event.target.value)}
                                placeholder="Any administrator" className="rounded-xl border border-border-subtle bg-transparent px-4 py-3" />
                        </label>
                        <button type="submit" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white">Apply</button>
                    </form>
                    <button type="button" onClick={() => { setAction(''); setActorInput(''); setActorId(''); setPage(1); }}
                        className="rounded-xl border border-border-subtle px-4 py-3 text-sm hover:bg-white/5">Clear filters</button>
                </div>
            </SurfaceCard>

            {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p>}

            <SurfaceCard>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold">Activity history</h2>
                    <span className="text-sm text-text-secondary">{data?.total ?? 0} entries</span>
                </div>
                {loading && <p role="status" className="py-8 text-center text-text-secondary">Loading audit entries...</p>}
                {!loading && !error && data?.items.length === 0 &&
                    <p className="py-8 text-center text-text-secondary">No audit entries match the selected filters.</p>}
                {!loading && !error && data && data.items.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className="text-xs uppercase tracking-wider text-text-secondary">
                                <tr>
                                    <th className="border-b border-border-subtle p-3">Time</th>
                                    <th className="border-b border-border-subtle p-3">Administrator</th>
                                    <th className="border-b border-border-subtle p-3">Action</th>
                                    <th className="border-b border-border-subtle p-3">Target</th>
                                    <th className="border-b border-border-subtle p-3">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((entry) => (
                                    <tr key={entry.id} className="align-top">
                                        <td className="border-b border-border-subtle p-3 whitespace-nowrap text-text-secondary">
                                            <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
                                        </td>
                                        <td className="border-b border-border-subtle p-3">
                                            {entry.actor ? entry.actor.username : 'Deleted / unknown'}
                                            <span className="block text-xs text-text-secondary">ID: {entry.actorId ?? '—'}</span>
                                        </td>
                                        <td className="border-b border-border-subtle p-3">
                                            <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 font-mono text-xs text-primary">{entry.action}</span>
                                        </td>
                                        <td className="border-b border-border-subtle p-3">
                                            <span className="font-medium">{entry.targetType}</span>
                                            <span className="block break-all font-mono text-xs text-text-secondary">{entry.targetId}</span>
                                        </td>
                                        <td className="border-b border-border-subtle p-3">
                                            {entry.metadata == null ? <span className="text-text-secondary">—</span> : (
                                                <>
                                                    <button type="button" aria-expanded={expandedId === entry.id}
                                                        onClick={() => setExpandedId((current) => current === entry.id ? null : entry.id)}
                                                        className="text-primary hover:underline">{expandedId === entry.id ? 'Hide' : 'View'}</button>
                                                    {expandedId === entry.id && (
                                                        <pre className="mt-2 max-w-sm overflow-auto rounded-lg border border-border-subtle bg-black/20 p-3 text-xs">
                                                            {JSON.stringify(entry.metadata, null, 2)}
                                                        </pre>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!loading && !error && data && (
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
                        <p className="text-sm text-text-secondary">Page {data.page} of {Math.max(1, data.pages)}</p>
                        <div className="flex gap-2">
                            <button type="button" disabled={page <= 1}
                                onClick={() => { setExpandedId(null); setPage((value) => Math.max(1, value - 1)); }}
                                className="flex items-center gap-1 rounded-xl border border-border-subtle px-3 py-2 text-sm disabled:opacity-40">
                                <ChevronLeft size={16} /> Previous
                            </button>
                            <button type="button" disabled={page >= data.pages}
                                onClick={() => { setExpandedId(null); setPage((value) => value + 1); }}
                                className="flex items-center gap-1 rounded-xl border border-border-subtle px-3 py-2 text-sm disabled:opacity-40">
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </SurfaceCard>
        </div>
    );
};

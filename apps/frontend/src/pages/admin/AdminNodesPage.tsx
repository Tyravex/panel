import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Plus, RefreshCw, Server } from 'lucide-react';
import {
    nodesApi,
    type NodeCredentials,
    type NodeRecord,
    type NodeStatus,
} from '@/features/nodes/api/nodesApi';
import { NodeTokenDialog } from '@/features/nodes/components/NodeTokenDialog';

const AUTO_REFRESH_INTERVAL_MS = 15_000;

const statusKeys: Record<NodeStatus, string> = {
    ONLINE: 'adminNodes.online',
    OFFLINE: 'adminNodes.offline',
    MAINTENANCE: 'adminNodes.maintenance',
};

const statusClasses: Record<NodeStatus, string> = {
    ONLINE: 'text-emerald-400 bg-emerald-500/10',
    OFFLINE: 'text-slate-400 bg-slate-500/10',
    MAINTENANCE: 'text-amber-400 bg-amber-500/10',
};

const apiErrorMessage = (error: unknown): string | null => {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (
            error as {
                response?: {
                    data?: { message?: string | string[] };
                };
            }
        ).response;

        const message = response?.data?.message;

        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return message.join(', ');
    }

    return error instanceof Error ? error.message : null;
};

export const AdminNodesPage = () => {
    const { t, i18n } = useTranslation();

    const [nodes, setNodes] = useState<NodeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [credentials, setCredentials] = useState<NodeCredentials | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => {
        setRefreshKey((value) => value + 1);
    }, []);

    const locale =
        i18n.resolvedLanguage === 'pl'
            ? 'pl-PL'
            : i18n.resolvedLanguage === 'de'
                ? 'de-DE'
                : 'en-US';

    const formatDate = (value: string | null): string => {
        if (!value) return t('adminNodes.never');

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? t('adminNodes.unknownDate')
            : date.toLocaleString(locale);
    };

    useEffect(() => {
        let active = true;
        let inFlight = false;
        let requestController: AbortController | null = null;

        const load = async () => {
            if (!active || inFlight) {
                return;
            }

            inFlight = true;
            const controller = new AbortController();
            requestController = controller;

            try {
                const result = await nodesApi.list(controller.signal);

                if (active && !controller.signal.aborted) {
                    setNodes(result);
                    setError('');
                }
            } catch (reason) {
                if (active && !controller.signal.aborted) {
                    setError(
                        apiErrorMessage(reason) ??
                        t('adminNodes.unexpectedError'),
                    );
                }
            } finally {
                if (requestController === controller) {
                    requestController = null;
                }

                inFlight = false;

                if (active && !controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        void load();

        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                void load();
            }
        }, AUTO_REFRESH_INTERVAL_MS);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void load();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            active = false;
            clearInterval(interval);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
            requestController?.abort();
        };
    }, [refreshKey, t]);

    const createNode = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const normalizedName = name.trim();

        if (!normalizedName || normalizedName.length > 100) {
            setError(t('adminNodes.invalidName'));
            return;
        }

        setBusy(true);
        setError('');

        try {
            const result = await nodesApi.create(normalizedName);
            setCredentials(result);
            setName('');
            refresh();
        } catch (reason) {
            setError(
                apiErrorMessage(reason) ??
                t('adminNodes.unexpectedError'),
            );
        } finally {
            setBusy(false);
        }
    };

    const rotateToken = async (node: NodeRecord) => {
        const confirmed = window.confirm(
            t('adminNodes.confirmRotate', { name: node.name }),
        );

        if (!confirmed) return;

        setBusy(true);
        setError('');

        try {
            const result = await nodesApi.rotateToken(node.id);
            setCredentials(result);
            refresh();
        } catch (reason) {
            setError(
                apiErrorMessage(reason) ??
                t('adminNodes.unexpectedError'),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-primary">
                        {t('admin.section.breadcrumb')}
                    </p>

                    <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold">
                        <Server size={28} aria-hidden="true" />
                        {t('adminNodes.title')}
                    </h1>

                    <p className="mt-2 text-text-secondary">
                        {t('adminNodes.description')}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={refresh}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2 hover:bg-white/5 disabled:opacity-50"
                >
                    <RefreshCw size={17} aria-hidden="true" />
                    {t('adminNodes.refresh')}
                </button>
            </header>

            <section className="rounded-2xl border border-border-subtle bg-surface p-6">
                <h2 className="text-lg font-semibold">
                    {t('adminNodes.addTitle')}
                </h2>

                <form
                    onSubmit={(event) => void createNode(event)}
                    className="mt-4 flex flex-wrap gap-3"
                >
                    <input
                        aria-label={t('adminNodes.nodeName')}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={100}
                        placeholder={t('adminNodes.nodeNamePlaceholder')}
                        disabled={busy}
                        className="min-w-56 flex-1 rounded-xl border border-border-subtle bg-transparent px-4 py-3"
                    />

                    <button
                        type="submit"
                        disabled={busy || !name.trim()}
                        className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50"
                    >
                        <Plus size={18} aria-hidden="true" />
                        {t(busy ? 'adminNodes.saving' : 'adminNodes.add')}
                    </button>
                </form>
            </section>

            {error && (
                <p
                    role="alert"
                    className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300"
                >
                    {error}
                </p>
            )}

            <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                <div className="flex items-center justify-between border-b border-border-subtle p-5">
                    <h2 className="text-lg font-semibold">
                        {t('adminNodes.listTitle')}
                    </h2>

                    <span className="text-sm text-text-secondary">
                        {t('adminNodes.count', { count: nodes.length })}
                    </span>
                </div>

                {loading ? (
                    <p className="p-6 text-text-secondary">
                        {t('adminNodes.loading')}
                    </p>
                ) : nodes.length === 0 ? (
                    <p className="p-6 text-text-secondary">
                        {t('adminNodes.empty')}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-border-subtle text-text-secondary">
                                <tr>
                                    <th scope="col" className="p-4">
                                        {t('adminNodes.name')}
                                    </th>
                                    <th scope="col" className="p-4">
                                        {t('adminNodes.status')}
                                    </th>
                                    <th scope="col" className="p-4">
                                        {t('adminNodes.lastSeen')}
                                    </th>
                                    <th scope="col" className="p-4">
                                        {t('adminNodes.created')}
                                    </th>
                                    <th scope="col" className="p-4">
                                        {t('adminNodes.actions')}
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {nodes.map((node) => (
                                    <tr
                                        key={node.id}
                                        className="border-b border-border-subtle last:border-0"
                                    >
                                        <td className="p-4">
                                            <p className="font-semibold">{node.name}</p>
                                            <p className="mt-1 font-mono text-xs text-text-secondary">
                                                {node.id}
                                            </p>
                                        </td>

                                        <td className="p-4">
                                            <span
                                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[node.status] ??
                                                    statusClasses.OFFLINE
                                                    }`}
                                            >
                                                {t(statusKeys[node.status] ?? statusKeys.OFFLINE)}
                                            </span>
                                        </td>

                                        <td className="p-4">
                                            {formatDate(node.lastSeenAt)}
                                        </td>

                                        <td className="p-4">
                                            {formatDate(node.createdAt)}
                                        </td>

                                        <td className="p-4">
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => void rotateToken(node)}
                                                className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 hover:bg-white/5 disabled:opacity-50"
                                            >
                                                <KeyRound size={15} aria-hidden="true" />
                                                {t('adminNodes.rotate')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {credentials && (
                <NodeTokenDialog
                    credentials={credentials}
                    onClose={() => setCredentials(null)}
                />
            )}
        </div>
    );
};
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    ChevronDown,
    ChevronRight,
    Globe2,
    KeyRound,
    Pencil,
    Trash2,
    LayoutList,
    MapPin,
    Plus,
    RefreshCw,
    Search,
    Server,
    Table2,
} from 'lucide-react';
import {
    nodesApi,
    type NodeCredentials,
    type NodeRecord,
    type NodeStatus,
} from '@/features/nodes/api/nodesApi';
import { NodeTokenDialog } from '@/features/nodes/components/NodeTokenDialog';
import { regionsApi } from '@/features/regions/api/regionsApi';
import { locationsApi } from '@/features/locations/api/locationsApi';
import type { RegionRecord, LocationRecord } from '@shared/types';
import { useAuthStore } from '@/app/store/auth.store';

type ViewMode = 'grouped' | 'table';
type Language = 'pl' | 'en';

type LocationGroup = {
    key: string;
    location: LocationRecord | null;
    nodes: NodeRecord[];
};

type RegionGroup = {
    key: string;
    region: RegionRecord | null;
    locations: LocationGroup[];
    count: number;
};

const copy = {
    pl: {
        grouped: 'Grupowanie',
        table: 'Tabela',
        expand: 'Rozwiń wszystko',
        collapse: 'Zwiń wszystko',
        unassignedRegion: 'Bez regionu',
        unassignedLocation: 'Bez lokalizacji',
        regions: 'Regiony',
        locations: 'Lokalizacje',
        all: 'Wszystkie',
        online: 'Online',
        other: 'Offline / inne',
        nodes: 'węzłów',
        countryUnknown: 'Nieznany kraj',
    },
    en: {
        grouped: 'Grouped',
        table: 'Table',
        expand: 'Expand all',
        collapse: 'Collapse all',
        unassignedRegion: 'Unassigned region',
        unassignedLocation: 'Unassigned location',
        regions: 'Regions',
        locations: 'Locations',
        all: 'All',
        online: 'Online',
        other: 'Offline / other',
        nodes: 'nodes',
        countryUnknown: 'Unknown country',
    },
} as const;

// ISO 3166-1 alpha-2 codes and commonly used country names.
// Unknown values deliberately receive no flag.
const countryCodes: Record<string, string> = {
    poland: 'PL', polska: 'PL', pl: 'PL',
    germany: 'DE', niemcy: 'DE', deutschland: 'DE', de: 'DE',
    france: 'FR', francja: 'FR', fr: 'FR',
    'united kingdom': 'GB', 'great britain': 'GB', uk: 'GB', gb: 'GB',
    'stany zjednoczone': 'US', 'united states': 'US',
    'united states of america': 'US', usa: 'US', us: 'US',
    canada: 'CA', kanada: 'CA', ca: 'CA',
    netherlands: 'NL', holandia: 'NL', nederland: 'NL', nl: 'NL',
    belgium: 'BE', belgia: 'BE', be: 'BE',
    austria: 'AT', at: 'AT',
    switzerland: 'CH', szwajcaria: 'CH', schweiz: 'CH', ch: 'CH',
    czechia: 'CZ', 'czech republic': 'CZ', czechy: 'CZ', cz: 'CZ',
    slovakia: 'SK', slowacja: 'SK', słowacja: 'SK', sk: 'SK',
    hungary: 'HU', wegry: 'HU', węgry: 'HU', hu: 'HU',
    italy: 'IT', wlochy: 'IT', włochy: 'IT', it: 'IT',
    spain: 'ES', hiszpania: 'ES', es: 'ES',
    portugal: 'PT', portugalia: 'PT', pt: 'PT',
    sweden: 'SE', szwecja: 'SE', se: 'SE',
    norway: 'NO', norwegia: 'NO', no: 'NO',
    denmark: 'DK', dania: 'DK', dk: 'DK',
    finland: 'FI', finlandia: 'FI', fi: 'FI',
    ireland: 'IE', irlandia: 'IE', ie: 'IE',
    ukraine: 'UA', ukraina: 'UA', ua: 'UA',
    lithuania: 'LT', litwa: 'LT', lt: 'LT',
    latvia: 'LV', łotwa: 'LV', lotwa: 'LV', lv: 'LV',
    estonia: 'EE', ee: 'EE',
    romania: 'RO', rumunia: 'RO', ro: 'RO',
    bulgaria: 'BG', bułgaria: 'BG', bg: 'BG',
    greece: 'GR', grecja: 'GR', gr: 'GR',
    turkey: 'TR', turcja: 'TR', türkiye: 'TR', tr: 'TR',
    japan: 'JP', japonia: 'JP', jp: 'JP',
    singapore: 'SG', singapur: 'SG', sg: 'SG',
    australia: 'AU', au: 'AU',
    brazil: 'BR', brazylia: 'BR', br: 'BR',
    india: 'IN', indie: 'IN', in: 'IN',
    'south korea': 'KR', 'korea południowa': 'KR', kr: 'KR',
    'united arab emirates': 'AE', zjednoczone_emiraty_arabskie: 'AE', ae: 'AE',
};

const flagForCountry = (country: string): string | null => {
    const normalized = country.trim().toLocaleLowerCase();
    const code = countryCodes[normalized];
    if (!code) return null;

    return [...code]
        .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
        .join('');
};

const getError = (reason: unknown): string => {
    if (typeof reason === 'object' && reason !== null && 'response' in reason) {
        const response = (reason as {
            response?: { data?: { message?: string | string[] } };
        }).response;

        const message = response?.data?.message;
        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return message.join(', ');
    }

    return reason instanceof Error ? reason.message : 'Unexpected error';
};

const formatDate = (value: string | null, locale: string, never: string): string => {
    if (!value) return never;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

export const AdminNodesPage = () => {
    const permissions = useAuthStore((state) => state.user?.permissions);
    const canManage = !!permissions?.includes('node:manage');
    const canDelete = !!permissions?.includes('node:delete');
    const canReadRegions = !!permissions?.includes('region:manage');
    const canReadLocations = !!permissions?.includes('location:manage');
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const language: Language = i18n.resolvedLanguage === 'pl' ? 'pl' : 'en';
    const m = copy[language];
    const locale = language === 'pl' ? 'pl-PL' : 'en-GB';

    const [nodes, setNodes] = useState<NodeRecord[]>([]);
    const [regions, setRegions] = useState<RegionRecord[]>([]);
    const [locations, setLocations] = useState<LocationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [credentials, setCredentials] = useState<NodeCredentials | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<NodeRecord | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const deleteDialogRef = useRef<HTMLDivElement | null>(null);
    const deleteInputRef = useRef<HTMLInputElement | null>(null);
    const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
    const deleteBusyRef = useRef(false);
    const deleteSucceededRef = useRef(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [viewMode, setViewMode] = useState<ViewMode>(
        canReadRegions && canReadLocations ? 'grouped' : 'table',
    );
    const [expanded, setExpanded] = useState<Set<string>>(
        () => new Set<string>(),
    );

    const refresh = useCallback(() => {
        setRefreshKey((value) => value + 1);
    }, []);

    useEffect(() => {
        if (!deleteTarget) return;

        deleteInputRef.current?.focus();

        return () => {
            if (!deleteSucceededRef.current) {
                const trigger = deleteTriggerRef.current;
                if (trigger?.isConnected && !trigger.disabled) {
                    trigger.focus();
                }
            }

            deleteTriggerRef.current = null;
            deleteSucceededRef.current = false;
        };
    }, [deleteTarget]);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        let inFlight = false;

        const load = async (silent: boolean) => {
            if (inFlight) return;
            inFlight = true;

            if (!silent) setLoading(true);
            else setRefreshing(true);

            try {
                const [nodeRecords, regionRecords, locationRecords] =
                    await Promise.all([
                        nodesApi.list(controller.signal),
                        canReadRegions ? regionsApi.list(controller.signal) : Promise.resolve([]),
                        canReadLocations ? locationsApi.list(controller.signal) : Promise.resolve([]),
                    ]);

                if (!active || controller.signal.aborted) return;

                setNodes(nodeRecords);
                setRegions(regionRecords);
                setLocations(locationRecords);
                setError('');
            } catch (reason) {
                if (!active || controller.signal.aborted) return;
                setError(getError(reason));
            } finally {
                inFlight = false;
                if (active && !controller.signal.aborted) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        };

        void load(false);

        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                void load(true);
            }
        }, 15000);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void load(true);
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            active = false;
            controller.abort();
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [refreshKey, canReadRegions, canReadLocations]);

    const regionById = useMemo(
        () => new Map(regions.map((region) => [region.id, region])),
        [regions],
    );

    const locationById = useMemo(
        () => new Map(locations.map((location) => [location.id, location])),
        [locations],
    );

    const visibleNodes = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();

        return nodes.filter((node) => {
            const region = node.regionId
                ? regionById.get(node.regionId)
                : undefined;
            const location = node.locationId
                ? locationById.get(node.locationId)
                : undefined;

            const searchText = [
                node.name,
                region?.name,
                region?.code,
                location?.name,
                location?.code,
                location?.country,
                location?.city,
            ].filter(Boolean).join(' ').toLocaleLowerCase();

            const matchesQuery =
                !normalizedQuery || searchText.includes(normalizedQuery);

            const matchesStatus =
                statusFilter === 'ALL' || node.status === statusFilter;

            return matchesQuery && matchesStatus;
        });
    }, [nodes, query, statusFilter, regionById, locationById]);

    const groups = useMemo<RegionGroup[]>(() => {
        const result = new Map<string, {
            region: RegionRecord | null;
            locations: Map<string, LocationGroup>;
            count: number;
        }>();

        for (const node of visibleNodes) {
            const region = node.regionId
                ? regionById.get(node.regionId) ?? null
                : null;

            const location = node.locationId
                ? locationById.get(node.locationId) ?? null
                : null;

            const regionKey = region ? `r:${region.id}` : 'r:unassigned';

            // A location with an inconsistent region assignment is kept
            // in the unassigned bucket rather than displayed incorrectly.
            const validLocation =
                location && region && location.regionId === region.id
                    ? location
                    : null;

            const locationKey = validLocation
                ? `l:${regionKey}:${validLocation.id}`
                : `l:${regionKey}:unassigned`;

            if (!result.has(regionKey)) {
                result.set(regionKey, {
                    region,
                    locations: new Map(),
                    count: 0,
                });
            }

            const group = result.get(regionKey)!;
            group.count += 1;

            if (!group.locations.has(locationKey)) {
                group.locations.set(locationKey, {
                    key: locationKey,
                    location: validLocation,
                    nodes: [],
                });
            }

            group.locations.get(locationKey)!.nodes.push(node);
        }

        return [...result.entries()]
            .map(([key, value]) => ({
                key,
                region: value.region,
                locations: [...value.locations.values()]
                    .sort((a, b) =>
                        (a.location?.name ?? m.unassignedLocation)
                            .localeCompare(
                                b.location?.name ?? m.unassignedLocation,
                                locale,
                            ),
                    ),
                count: value.count,
            }))
            .sort((a, b) =>
                (a.region?.name ?? m.unassignedRegion)
                    .localeCompare(
                        b.region?.name ?? m.unassignedRegion,
                        locale,
                    ),
            );
    }, [visibleNodes, regionById, locationById, m, locale]);

    const isFiltering = query.trim().length > 0 || statusFilter !== 'ALL';

    // Automatically expand newly discovered regions and locations.
    // Preserve manual collapse/expand choices during polling.
    const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(
        () => new Set<string>(),
    );

    const isOpen = (key: string): boolean =>
        isFiltering || (expanded.has(key) && !collapsedKeys.has(key)) ||
        (!collapsedKeys.has(key) && !expanded.has(key));

    const toggle = (key: string) => {
        setCollapsedKeys((previous) => {
            const next = new Set(previous);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const expandAll = () => {
        setCollapsedKeys(new Set());
    };

    const collapseAll = () => {
        const keys = groups.flatMap((group) => [
            group.key,
            ...group.locations.map((location) => location.key),
        ]);
        setCollapsedKeys(new Set(keys));
    };

    const rotateToken = async (node: NodeRecord) => {
        if (!canManage) return;
        if (!window.confirm(t('adminNodes.confirmRotate', { name: node.name }))) {
            return;
        }

        setBusyId(node.id);
        setError('');

        try {
            const result = await nodesApi.rotateToken(node.id);
            setCredentials(result);
            refresh();
        } catch (reason) {
            setError(getError(reason));
        } finally {
            setBusyId(null);
        }
    };

    const openDeleteDialog = (
        node: NodeRecord,
        trigger: HTMLButtonElement,
    ) => {
        if (!canDelete || busyId !== null || deleteBusyRef.current) return;

        deleteTriggerRef.current = trigger;
        deleteSucceededRef.current = false;
        setDeleteTarget(node);
        setDeleteConfirmation('');
        setDeleteError('');
    };

    const closeDeleteDialog = () => {
        if (busyId !== null || deleteBusyRef.current) return;

        setDeleteTarget(null);
        setDeleteConfirmation('');
        setDeleteError('');
    };

    const handleDeleteDialogKeyDown = (
        event: React.KeyboardEvent<HTMLDivElement>,
    ) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();

            if (!deleteBusyRef.current && busyId === null) {
                closeDeleteDialog();
            }

            return;
        }

        if (event.key !== 'Tab') return;

        const dialog = deleteDialogRef.current;
        if (!dialog) return;

        const focusable = Array.from(
            dialog.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), ' +
                'select:not([disabled]), textarea:not([disabled]), ' +
                'a[href], [tabindex]:not([tabindex="-1"])',
            ),
        ).filter((element) => element.getClientRects().length > 0);

        if (focusable.length === 0) {
            event.preventDefault();
            dialog.focus();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey) {
            if (active === first || !dialog.contains(active)) {
                event.preventDefault();
                last.focus();
            }
        } else if (active === last || !dialog.contains(active)) {
            event.preventDefault();
            first.focus();
        }
    };

    const confirmDelete = async () => {
        const node = deleteTarget;

        if (
            !canDelete ||
            !node ||
            busyId !== null ||
            deleteBusyRef.current ||
            deleteConfirmation !== node.name
        ) {
            return;
        }

        deleteBusyRef.current = true;
        setBusyId(node.id);
        setDeleteError('');
        setError('');

        try {
            await nodesApi.delete(node.id);
            deleteSucceededRef.current = true;
            setDeleteTarget(null);
            setDeleteConfirmation('');
            refresh();
        } catch (reason) {
            const status =
                typeof reason === 'object' &&
                    reason !== null &&
                    'response' in reason
                    ? (reason as { response?: { status?: number } })
                        .response?.status
                    : undefined;

            if (status === 409) {
                setDeleteError(t('adminNodes.deleteConflict'));
            } else if (status === 404) {
                setDeleteError(t('adminNodes.deleteNotFound'));
                refresh();
            } else {
                setDeleteError(getError(reason));
            }
        } finally {
            deleteBusyRef.current = false;
            setBusyId(null);
        }
    };

    const statusLabel = (status: NodeStatus): string => {
        switch (status) {
            case 'ONLINE': return t('adminNodes.online');
            case 'OFFLINE': return t('adminNodes.offline');
            case 'MAINTENANCE': return t('adminNodes.maintenance');
            default: return status;
        }
    };

    const statusClass = (status: NodeStatus): string => {
        switch (status) {
            case 'ONLINE':
                return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400';
            case 'MAINTENANCE':
                return 'border-amber-500/25 bg-amber-500/10 text-amber-400';
            default:
                return 'border-slate-500/25 bg-slate-500/10 text-slate-300';
        }
    };

    const nodeTable = (items: NodeRecord[]) => (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-border-subtle text-text-secondary">
                        <th className="px-3 py-3 font-medium">{t('adminNodes.name')}</th>
                        <th className="px-3 py-3 font-medium">{t('adminNodes.status')}</th>
                        <th className="px-3 py-3 font-medium">{t('adminNodes.lastSeen')}</th>
                        <th className="px-3 py-3 font-medium">{t('adminNodes.created')}</th>
                        <th className="px-3 py-3 text-right font-medium">
                            {t('adminNodes.actions')}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((node) => (
                        <tr
                            key={node.id}
                            className="border-b border-border-subtle/70 last:border-0"
                        >
                            <td className="px-3 py-4 font-semibold">
                                <button
                                    type="button"
                                    onClick={() => navigate(
                                        `/admin/nodes/${encodeURIComponent(node.id)}`,
                                    )}
                                    className="text-left hover:text-primary hover:underline"
                                >
                                    {node.name}
                                </button>
                            </td>
                            <td className="px-3 py-4">
                                <span className={
                                    `inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClass(node.status)}`
                                }>
                                    {statusLabel(node.status)}
                                </span>
                            </td>
                            <td className="px-3 py-4 text-text-secondary">
                                {formatDate(
                                    node.lastSeenAt,
                                    locale,
                                    t('adminNodes.never'),
                                )}
                            </td>
                            <td className="px-3 py-4 text-text-secondary">
                                {formatDate(
                                    node.createdAt,
                                    locale,
                                    t('adminNodes.never'),
                                )}
                            </td>
                            <td className="px-3 py-4 text-right">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => navigate(
                                            `/admin/nodes/${encodeURIComponent(node.id)}?tab=settings`,
                                        )}
                                        disabled={!canManage}
                                        className="inline-flex items-center gap-2 rounded-lg border border-primary/40 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10"
                                    >
                                        <Pencil size={15} aria-hidden="true" />
                                        {language === 'pl' ? 'Edytuj' : 'Edit'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => void rotateToken(node)}
                                        disabled={!canManage || busyId !== null}
                                        className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-xs font-medium hover:bg-white/5 disabled:opacity-50"
                                    >
                                        <KeyRound size={15} aria-hidden="true" />
                                        {busyId === node.id
                                            ? t('adminNodes.saving')
                                            : t('adminNodes.rotate')}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={(event) => openDeleteDialog(node, event.currentTarget)}
                                        disabled={!canDelete || busyId !== null}
                                        className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Trash2 size={15} aria-hidden="true" />
                                        {t('adminNodes.delete')}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Server size={28} aria-hidden="true" />
                    <div>
                        <h1 className="text-3xl font-bold">
                            {t('adminNodes.title')}
                        </h1>
                        <p className="mt-1 text-text-secondary">
                            {t('adminNodes.description')}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={refresh}
                        disabled={loading || refreshing}
                        className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                    >
                        <RefreshCw
                            size={17}
                            className={refreshing ? 'animate-spin' : ''}
                            aria-hidden="true"
                        />
                        {t('adminNodes.refresh')}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/admin/nodes/new')}
                        disabled={!canManage || !canReadRegions || !canReadLocations}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
                    >
                        <Plus size={18} aria-hidden="true" />
                        {t('adminNodes.listPage_newNode')}
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: m.all, value: nodes.length },
                    {
                        label: m.online,
                        value: nodes.filter((node) => node.status === 'ONLINE').length,
                    },
                    {
                        label: m.other,
                        value: nodes.filter((node) => node.status !== 'ONLINE').length,
                    },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className="rounded-2xl border border-border-subtle bg-surface p-4"
                    >
                        <p className="text-xs text-text-secondary">{stat.label}</p>
                        <p className="mt-2 text-2xl font-bold">{stat.value}</p>
                    </div>
                ))}
            </div>

            <section className="rounded-2xl border border-border-subtle bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold">
                            {t('adminNodes.listTitle')}
                        </h2>
                        <p className="mt-1 text-sm text-text-secondary">
                            {t('adminNodes.count', { count: visibleNodes.length })}
                        </p>
                    </div>

                    <div className="flex w-full flex-wrap gap-3 md:w-auto">
                        <div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
                            <Search
                                size={17}
                                aria-hidden="true"
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
                            />
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={t('adminNodes.listPage_search')}
                                aria-label={t('adminNodes.listPage_search')}
                                className="w-full rounded-xl border border-border-subtle bg-transparent py-2.5 pl-10 pr-3 text-sm"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            aria-label={t('adminNodes.listPage_filterStatus')}
                            className="rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm"
                        >
                            <option value="ALL">
                                {t('adminNodes.listPage_allStatuses')}
                            </option>
                            <option value="ONLINE">{t('adminNodes.online')}</option>
                            <option value="OFFLINE">{t('adminNodes.offline')}</option>
                            <option value="MAINTENANCE">{t('adminNodes.maintenance')}</option>
                        </select>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setViewMode('grouped')}
                            aria-pressed={viewMode === 'grouped'}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${viewMode === 'grouped'
                                ? 'border-primary bg-primary text-white'
                                : 'border-border-subtle'
                                }`}
                        >
                            <LayoutList size={16} />
                            {m.grouped}
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            aria-pressed={viewMode === 'table'}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${viewMode === 'table'
                                ? 'border-primary bg-primary text-white'
                                : 'border-border-subtle'
                                }`}
                        >
                            <Table2 size={16} />
                            {m.table}
                        </button>
                    </div>

                    {viewMode === 'grouped' && (
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={expandAll}
                                className="rounded-lg border border-border-subtle px-3 py-2 text-xs"
                            >
                                {m.expand}
                            </button>
                            <button
                                type="button"
                                onClick={collapseAll}
                                className="rounded-lg border border-border-subtle px-3 py-2 text-xs"
                            >
                                {m.collapse}
                            </button>
                        </div>
                    )}
                </div>

                {error && (
                    <p
                        role="alert"
                        className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300"
                    >
                        {error}
                    </p>
                )}

                {loading ? (
                    <p className="py-12 text-center text-text-secondary">
                        {t('adminNodes.loading')}
                    </p>
                ) : visibleNodes.length === 0 ? (
                    <p className="py-12 text-center text-text-secondary">
                        {nodes.length === 0
                            ? t('adminNodes.empty')
                            : t('adminNodes.listPage_noMatches')}
                    </p>
                ) : viewMode === 'table' ? (
                    <div className="mt-5">{nodeTable(visibleNodes)}</div>
                ) : (
                    <div className="mt-5 space-y-3">
                        {groups.map((group) => {
                            const regionOpen = isOpen(group.key);

                            return (
                                <div
                                    key={group.key}
                                    className="overflow-hidden rounded-xl border border-border-subtle"
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggle(group.key)}
                                        aria-expanded={regionOpen}
                                        className="flex w-full items-center gap-3 p-4 text-left hover:bg-white/5"
                                    >
                                        {regionOpen
                                            ? <ChevronDown size={17} />
                                            : <ChevronRight size={17} />}
                                        <Globe2 size={19} className="text-text-secondary" />
                                        <span className="flex-1 font-semibold">
                                            {group.region?.name ?? m.unassignedRegion}
                                        </span>
                                        <span className="text-xs text-text-secondary">
                                            {group.count} {m.nodes}
                                        </span>
                                    </button>

                                    {regionOpen && (
                                        <div className="space-y-3 px-3 pb-3">
                                            {group.locations.map((locationGroup) => {
                                                const locationOpen =
                                                    isOpen(locationGroup.key);
                                                const location = locationGroup.location;
                                                const flag = location
                                                    ? flagForCountry(location.country)
                                                    : null;

                                                return (
                                                    <div
                                                        key={locationGroup.key}
                                                        className="overflow-hidden rounded-xl border border-border-subtle bg-background/20"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => toggle(locationGroup.key)}
                                                            aria-expanded={locationOpen}
                                                            className="flex w-full items-center gap-3 p-3 text-left hover:bg-white/5"
                                                        >
                                                            {locationOpen
                                                                ? <ChevronDown size={16} />
                                                                : <ChevronRight size={16} />}
                                                            {flag ? (
                                                                <img
                                                                    src={`https://flagcdn.com/w40/${countryCodes[location!.country.trim().toLocaleLowerCase()].toLowerCase()}.png`}
                                                                    alt={location?.country ?? ''}
                                                                    title={location?.country}
                                                                    width={24}
                                                                    height={16}
                                                                    className="h-4 w-6 rounded-sm object-cover"
                                                                />
                                                            ) : (
                                                                <MapPin
                                                                    size={20}
                                                                    className="text-text-secondary"
                                                                />
                                                            )}
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block text-sm font-semibold">
                                                                    {location?.name ?? m.unassignedLocation}
                                                                </span>
                                                                {location && (
                                                                    <span className="block text-xs text-text-secondary">
                                                                        {[
                                                                            location.country || m.countryUnknown,
                                                                            location.city,
                                                                        ].filter(Boolean).join(' · ')}
                                                                    </span>
                                                                )}
                                                            </span>
                                                            <span className="text-xs text-text-secondary">
                                                                {locationGroup.nodes.length}
                                                            </span>
                                                        </button>

                                                        {locationOpen &&
                                                            nodeTable(locationGroup.nodes)}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {deleteTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    role="presentation"
                >
                    <div
                        ref={deleteDialogRef}
                        role="dialog"
                        tabIndex={-1}
                        onKeyDown={handleDeleteDialogKeyDown}
                        aria-modal="true"
                        aria-labelledby="delete-node-title"
                        aria-describedby="delete-node-description"
                        className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-surface p-6 shadow-2xl"
                    >
                        <div className="mb-4 flex items-center gap-3 text-red-400">
                            <Trash2 size={24} aria-hidden="true" />
                            <h2
                                id="delete-node-title"
                                className="text-xl font-bold"
                            >
                                {t('adminNodes.deleteTitle')}
                            </h2>
                        </div>

                        <p
                            id="delete-node-description"
                            className="mb-4 text-sm text-text-secondary"
                        >
                            {t('adminNodes.deleteWarning')}
                        </p>

                        <div className="mb-4 rounded-lg border border-border-subtle bg-background/50 p-3">
                            <span className="block text-xs text-text-secondary">
                                {t('adminNodes.name')}
                            </span>
                            <strong className="break-all text-sm">
                                {deleteTarget.name}
                            </strong>
                        </div>

                        <label
                            htmlFor="delete-node-confirmation"
                            className="mb-2 block text-sm font-medium"
                        >
                            {t('adminNodes.deleteTypeName')}
                        </label>

                        <input
                            ref={deleteInputRef}
                            id="delete-node-confirmation"
                            type="text"
                            autoComplete="off"
                            spellCheck={false}
                            value={deleteConfirmation}
                            onChange={(event) =>
                                setDeleteConfirmation(event.target.value)
                            }
                            disabled={busyId !== null}
                            placeholder={deleteTarget.name}
                            className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-red-400 disabled:opacity-50"
                        />

                        {deleteError && (
                            <p
                                role="alert"
                                className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
                            >
                                {deleteError}
                            </p>
                        )}

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeDeleteDialog}
                                disabled={busyId !== null}
                                className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-50"
                            >
                                {t('adminNodes.cancelDelete')}
                            </button>

                            <button
                                type="button"
                                onClick={() => void confirmDelete()}
                                disabled={
                                    busyId !== null ||
                                    deleteConfirmation !== deleteTarget.name
                                }
                                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Trash2 size={16} aria-hidden="true" />
                                {busyId === deleteTarget.id
                                    ? t('adminNodes.deleting')
                                    : t('adminNodes.deleteTitle')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {credentials && (
                <NodeTokenDialog
                    credentials={credentials}
                    onClose={() => setCredentials(null)}
                />
            )}
        </div>
    );
};

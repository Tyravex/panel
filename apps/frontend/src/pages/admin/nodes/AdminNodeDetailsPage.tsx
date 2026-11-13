import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, RefreshCw, Save, Server } from 'lucide-react';
import {
    nodesApi,
    type NodeRecord,
    type UpdateNodeRequest,
} from '@/features/nodes/api/nodesApi';
import { regionsApi } from '@/features/regions/api/regionsApi';
import { locationsApi } from '@/features/locations/api/locationsApi';
import type { RegionRecord, LocationRecord } from '@shared/types';

type NodeTab = 'overview' | 'settings' | 'agent' | 'network' | 'services' | 'tags';
type Language = 'pl' | 'en';

const tabs: NodeTab[] = [
    'overview',
    'settings',
    'agent',
    'network',
    'services',
    'tags',
];

const labels: Record<NodeTab, Record<Language, string>> = {
    overview: { pl: 'Przegląd', en: 'Overview' },
    settings: { pl: 'Ustawienia', en: 'Settings' },
    agent: { pl: 'Agent', en: 'Agent' },
    network: { pl: 'Sieć / Porty', en: 'Network / Ports' },
    services: { pl: 'Usługi', en: 'Services' },
    tags: { pl: 'Tagi', en: 'Tags' },
};

const messages = {
    pl: {
        back: 'Wróć do węzłów',
        title: 'Szczegóły węzła',
        loading: 'Ładowanie węzła...',
        missingId: 'Brak identyfikatora węzła.',
        refresh: 'Odśwież',
        name: 'Nazwa węzła',
        status: 'Status',
        region: 'Region',
        location: 'Lokalizacja',
        selectRegion: 'Wybierz region',
        selectLocation: 'Wybierz lokalizację',
        unassigned: 'Nieprzypisany',
        allocation: 'Sposób przydzielania usług',
        manual: 'Ręczny przydział przez administratora',
        manualDescription: 'Administrator może ręcznie przypisywać usługi do węzła.',
        automatic: 'Automatyczny przydział przez plugin płatności',
        automaticDescription: 'Plugin płatności może przydzielać usługi przez backend.',
        invalidName: 'Nazwa musi mieć od 1 do 100 znaków.',
        invalidAssignment: 'Wybierz prawidłowy Region i należącą do niego Location.',
        invalidAllocation: 'Co najmniej jedna metoda alokacji musi być włączona.',
        save: 'Zapisz zmiany',
        saving: 'Zapisywanie...',
        saved: 'Ustawienia węzła zostały zapisane.',
        placeholder: 'Ta zakładka zostanie rozwinięta w kolejnym kroku.',
    },
    en: {
        back: 'Back to nodes',
        title: 'Node details',
        loading: 'Loading node...',
        missingId: 'Missing node ID.',
        refresh: 'Refresh',
        name: 'Node name',
        status: 'Status',
        region: 'Region',
        location: 'Location',
        selectRegion: 'Select region',
        selectLocation: 'Select location',
        unassigned: 'Unassigned',
        allocation: 'Service allocation',
        manual: 'Manual allocation by administrator',
        manualDescription: 'Administrators can manually assign services to this node.',
        automatic: 'Automatic allocation by payment plugin',
        automaticDescription: 'The payment plugin can allocate services through the backend.',
        invalidName: 'Name must contain between 1 and 100 characters.',
        invalidAssignment: 'Select a valid region and a location within it.',
        invalidAllocation: 'At least one allocation method must be enabled.',
        save: 'Save changes',
        saving: 'Saving...',
        saved: 'Node settings saved successfully.',
        placeholder: 'This tab will be implemented in a following step.',
    },
} as const;

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

export const AdminNodeDetailsPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { i18n } = useTranslation();
    const language: Language = i18n.resolvedLanguage === 'pl' ? 'pl' : 'en';
    const m = messages[language];

    const [node, setNode] = useState<NodeRecord | null>(null);
    const [regions, setRegions] = useState<RegionRecord[]>([]);
    const [locations, setLocations] = useState<LocationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [tab, setTab] = useState<NodeTab>(() =>
        searchParams.get('tab') === 'settings' ? 'settings' : 'overview',
    );
    const [refreshKey, setRefreshKey] = useState(0);

    const [name, setName] = useState('');
    const [regionId, setRegionId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [manualAllocation, setManualAllocation] = useState(true);
    const [automaticAllocation, setAutomaticAllocation] = useState(false);

    const applyNode = useCallback((record: NodeRecord) => {
        setNode(record);
        setName(record.name);
        setRegionId(record.regionId ?? '');
        setLocationId(record.locationId ?? '');
        setManualAllocation(record.manualAllocationEnabled);
        setAutomaticAllocation(record.automaticAllocationEnabled);
    }, []);

    const availableLocations = useMemo(
        () => locations.filter((location) => location.regionId === regionId),
        [locations, regionId],
    );

    useEffect(() => {
        if (!id) {
            setNode(null);
            setError(messages.en.missingId);
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        const load = async () => {
            setLoading(true);
            setError('');
            setSuccess('');

            try {
                const [nodeRecord, regionRecords, locationRecords] = await Promise.all([
                    nodesApi.getById(id, controller.signal),
                    regionsApi.list(controller.signal),
                    locationsApi.list(controller.signal),
                ]);

                if (controller.signal.aborted) return;

                applyNode(nodeRecord);
                setRegions(regionRecords);
                setLocations(locationRecords);
            } catch (reason) {
                if (!controller.signal.aborted) {
                    setNode(null);
                    setError(getError(reason));
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void load();

        return () => controller.abort();
    }, [id, refreshKey, applyNode]);

    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!id || !node || busy) return;

        const normalizedName = name.trim();

        if (!normalizedName || normalizedName.length > 100) {
            setError(m.invalidName);
            setSuccess('');
            return;
        }

        if (!manualAllocation && !automaticAllocation) {
            setError(m.invalidAllocation);
            setSuccess('');
            return;
        }

        if (
            !regions.some((region) => region.id === regionId) ||
            !availableLocations.some((location) => location.id === locationId)
        ) {
            setError(m.invalidAssignment);
            setSuccess('');
            return;
        }

        const payload: UpdateNodeRequest = {
            name: normalizedName,
            regionId,
            locationId,
            manualAllocationEnabled: manualAllocation,
            automaticAllocationEnabled: automaticAllocation,
        };

        setBusy(true);
        setError('');
        setSuccess('');

        try {
            await nodesApi.update(id, payload);
            const updated = await nodesApi.getById(id);
            applyNode(updated);
            setSuccess(m.saved);
        } catch (reason) {
            setError(getError(reason));
        } finally {
            setBusy(false);
        }
    };

    const fieldClass =
        'w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-text-primary disabled:opacity-50';

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="space-y-4">
                <button
                    type="button"
                    onClick={() => navigate('/admin/nodes')}
                    className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
                >
                    <ArrowLeft size={16} aria-hidden="true" />
                    {m.back}
                </button>

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Server size={28} aria-hidden="true" />
                        <div>
                            <h1 className="text-3xl font-bold">
                                {node?.name ?? m.title}
                            </h1>
                            <p className="mt-1 text-sm text-text-secondary">
                                {node?.id ?? ''}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setRefreshKey((value) => value + 1)}
                        disabled={loading || busy}
                        className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                    >
                        <RefreshCw size={17} aria-hidden="true" />
                        {m.refresh}
                    </button>
                </div>
            </header>

            {error && (
                <p
                    role="alert"
                    className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300"
                >
                    {error}
                </p>
            )}

            {success && (
                <p
                    role="status"
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300"
                >
                    {success}
                </p>
            )}

            {loading ? (
                <p className="py-12 text-center text-text-secondary">
                    {m.loading}
                </p>
            ) : node ? (
                <>
                    <nav
                        aria-label={m.title}
                        className="flex flex-wrap gap-2 border-b border-border-subtle pb-3"
                    >
                        {tabs.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => {
                                    setTab(item);
                                    setError('');
                                    setSuccess('');
                                }}
                                aria-current={tab === item ? 'page' : undefined}
                                className={
                                    tab === item
                                        ? 'rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white'
                                        : 'rounded-xl border border-border-subtle bg-surface px-4 py-2 text-sm text-text-secondary'
                                }
                            >
                                {labels[item][language]}
                            </button>
                        ))}
                    </nav>

                    {tab === 'overview' ? (
                        <section className="rounded-2xl border border-border-subtle bg-surface p-6">
                            <h2 className="text-xl font-semibold">
                                {labels.overview[language]}
                            </h2>

                            <dl className="mt-5 grid gap-5 md:grid-cols-2">
                                <div>
                                    <dt className="text-sm text-text-secondary">{m.name}</dt>
                                    <dd className="mt-1 font-medium">{node.name}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-text-secondary">{m.status}</dt>
                                    <dd className="mt-1 font-medium">{node.status}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-text-secondary">{m.region}</dt>
                                    <dd className="mt-1 font-medium">
                                        {regions.find((region) => region.id === node.regionId)?.name ??
                                            m.unassigned}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-text-secondary">{m.location}</dt>
                                    <dd className="mt-1 font-medium">
                                        {locations.find((location) => location.id === node.locationId)?.name ??
                                            m.unassigned}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-text-secondary">{m.manual}</dt>
                                    <dd className="mt-1 font-medium">
                                        {node.manualAllocationEnabled ? 'ON' : 'OFF'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-text-secondary">{m.automatic}</dt>
                                    <dd className="mt-1 font-medium">
                                        {node.automaticAllocationEnabled ? 'ON' : 'OFF'}
                                    </dd>
                                </div>
                            </dl>
                        </section>
                    ) : tab === 'settings' ? (
                        <form onSubmit={(event) => void save(event)} className="space-y-6">
                            <section className="rounded-2xl border border-border-subtle bg-surface p-6">
                                <h2 className="mb-5 text-xl font-semibold">
                                    {labels.settings[language]}
                                </h2>

                                <div className="grid gap-5 md:grid-cols-2">
                                    <div className="md:col-span-2">
                                        <label htmlFor="node-settings-name" className="mb-2 block text-sm font-medium">
                                            {m.name}
                                        </label>
                                        <input
                                            id="node-settings-name"
                                            value={name}
                                            onChange={(event) => setName(event.target.value)}
                                            maxLength={100}
                                            required
                                            disabled={busy}
                                            className={fieldClass}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="node-settings-region" className="mb-2 block text-sm font-medium">
                                            {m.region}
                                        </label>
                                        <select
                                            id="node-settings-region"
                                            value={regionId}
                                            onChange={(event) => {
                                                setRegionId(event.target.value);
                                                setLocationId('');
                                            }}
                                            disabled={busy}
                                            required
                                            className={fieldClass}
                                        >
                                            <option value="" disabled>{m.selectRegion}</option>
                                            {regions.map((region) => (
                                                <option key={region.id} value={region.id}>
                                                    {region.name} ({region.code})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label htmlFor="node-settings-location" className="mb-2 block text-sm font-medium">
                                            {m.location}
                                        </label>
                                        <select
                                            id="node-settings-location"
                                            value={locationId}
                                            onChange={(event) => setLocationId(event.target.value)}
                                            disabled={busy || !regionId}
                                            required
                                            className={fieldClass}
                                        >
                                            <option value="" disabled>{m.selectLocation}</option>
                                            {availableLocations.map((location) => (
                                                <option key={location.id} value={location.id}>
                                                    {location.name} ({location.code})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-border-subtle bg-surface p-6">
                                <h2 className="text-xl font-semibold">{m.allocation}</h2>

                                <div className="mt-5 space-y-4">
                                    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border-subtle p-4">
                                        <span>
                                            <span className="block font-medium">{m.manual}</span>
                                            <span className="mt-1 block text-sm text-text-secondary">
                                                {m.manualDescription}
                                            </span>
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={manualAllocation}
                                            disabled={busy}
                                            onChange={(event) => {
                                                if (!event.target.checked && !automaticAllocation) return;
                                                setManualAllocation(event.target.checked);
                                            }}
                                            className="h-5 w-5 accent-primary"
                                        />
                                    </label>

                                    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border-subtle p-4">
                                        <span>
                                            <span className="block font-medium">{m.automatic}</span>
                                            <span className="mt-1 block text-sm text-text-secondary">
                                                {m.automaticDescription}
                                            </span>
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={automaticAllocation}
                                            disabled={busy}
                                            onChange={(event) => {
                                                if (!event.target.checked && !manualAllocation) return;
                                                setAutomaticAllocation(event.target.checked);
                                            }}
                                            className="h-5 w-5 accent-primary"
                                        />
                                    </label>
                                </div>
                            </section>

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={busy || !name.trim() || !regionId || !locationId}
                                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50"
                                >
                                    <Save size={18} aria-hidden="true" />
                                    {busy ? m.saving : m.save}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <section className="rounded-2xl border border-border-subtle bg-surface p-6">
                            <h2 className="text-xl font-semibold">
                                {labels[tab][language]}
                            </h2>
                            <p className="mt-4 text-sm text-text-secondary">
                                {m.placeholder}
                            </p>
                        </section>
                    )}
                </>
            ) : null}
        </div>
    );
};
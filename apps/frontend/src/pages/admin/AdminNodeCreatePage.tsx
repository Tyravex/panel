import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Listbox,
    ListboxButton,
    ListboxOption,
    ListboxOptions,
} from '@headlessui/react';
import {
    ArrowLeft,
    ChevronDown,
    Plus,
    Server,
} from 'lucide-react';
import {
    nodesApi,
    type NodeCredentials,
} from '@/features/nodes/api/nodesApi';
import { NodeTokenDialog } from '@/features/nodes/components/NodeTokenDialog';
import { regionsApi } from '@/features/regions/api/regionsApi';
import { locationsApi } from '@/features/locations/api/locationsApi';
import type { RegionRecord, LocationRecord } from '@shared/types';

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

export const AdminNodeCreatePage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [regionId, setRegionId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [regions, setRegions] = useState<RegionRecord[]>([]);
    const [locations, setLocations] = useState<LocationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [credentials, setCredentials] = useState<NodeCredentials | null>(null);

    const [manualAllocation, setManualAllocation] = useState(true);
    const [automaticAllocation, setAutomaticAllocation] = useState(false);

    const availableLocations = useMemo(
        () => locations.filter((location) => location.regionId === regionId),
        [locations, regionId],
    );

    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            try {
                const [regionRecords, locationRecords] = await Promise.all([
                    regionsApi.list(controller.signal),
                    locationsApi.list(controller.signal),
                ]);

                if (!controller.signal.aborted) {
                    setRegions(regionRecords);
                    setLocations(locationRecords);
                }
            } catch (reason) {
                if (!controller.signal.aborted) {
                    setError(getError(reason));
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void load();
        return () => controller.abort();
    }, []);

    const createNode = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const normalizedName = name.trim();

        if (!normalizedName || normalizedName.length > 100) {
            setError(t('adminNodes.invalidName'));
            return;
        }

        if (
            !regions.some((region) => region.id === regionId) ||
            !availableLocations.some((location) => location.id === locationId)
        ) {
            setError(
                t('adminNodes.createPage_invalidAssignment'),
            );
            return;
        }


        setBusy(true);
        setError('');

        try {
            const result = await nodesApi.create(normalizedName, {
                regionId,
                locationId,
                manualAllocationEnabled: manualAllocation,
                automaticAllocationEnabled: automaticAllocation,
            });
            setCredentials(result);
        } catch (reason) {
            setError(getError(reason));
        } finally {
            setBusy(false);
        }
    };

    const selectClasses =
        'flex w-full items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-left text-text-primary disabled:opacity-50';

    const optionsClasses =
        'z-50 max-h-64 w-[var(--button-width)] overflow-y-auto rounded-xl border border-border-subtle bg-[#17243a] p-1 text-white shadow-2xl [--anchor-gap:4px] focus:outline-none';

    const optionClasses =
        'cursor-pointer rounded-lg px-3 py-2 text-sm data-[focus]:bg-white/15 data-[selected]:bg-primary/20';

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <header className="space-y-4">
                <button
                    type="button"
                    onClick={() => navigate('/admin/nodes')}
                    className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
                >
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t('adminNodes.createPage_back')}
                </button>

                <div className="flex items-center gap-3">
                    <Server size={28} aria-hidden="true" />
                    <div>
                        <h1 className="text-3xl font-bold">
                            {t('adminNodes.createPage_title')}
                        </h1>
                        <p className="mt-1 text-text-secondary">
                            {t('adminNodes.createPage_description')}
                        </p>
                    </div>
                </div>
            </header>

            <form onSubmit={(event) => void createNode(event)} className="space-y-6">
                <section className="rounded-2xl border border-border-subtle bg-surface p-6">
                    <h2 className="mb-5 text-lg font-semibold">
                        {t('adminNodes.createPage_identity')}
                    </h2>

                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label htmlFor="new-node-name" className="mb-2 block text-sm font-medium">
                                {t('adminNodes.createPage_name')}
                            </label>
                            <input
                                id="new-node-name"
                                required
                                maxLength={100}
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                placeholder={t('adminNodes.createPage_namePlaceholder')}
                                disabled={busy}
                                className="w-full rounded-xl border border-border-subtle bg-transparent px-4 py-3"
                            />
                        </div>

                        <div>
                            <p className="mb-2 text-sm font-medium">
                                {t('adminNodes.createPage_region')}
                            </p>
                            <Listbox
                                value={regionId}
                                onChange={(value: string) => {
                                    setRegionId(value);
                                    setLocationId('');
                                }}
                                disabled={busy || loading}
                            >
                                <div className="relative">
                                    <ListboxButton className={selectClasses}>
                                        <span className="truncate">
                                            {regions.find((region) => region.id === regionId)?.name ??
                                                t('adminNodes.createPage_selectRegion')}
                                        </span>
                                        <ChevronDown size={17} aria-hidden="true" />
                                    </ListboxButton>
                                    <ListboxOptions anchor="bottom start" className={optionsClasses}>
                                        {regions.map((region) => (
                                            <ListboxOption
                                                key={region.id}
                                                value={region.id}
                                                className={optionClasses}
                                            >
                                                {region.name} ({region.code})
                                            </ListboxOption>
                                        ))}
                                    </ListboxOptions>
                                </div>
                            </Listbox>
                        </div>

                        <div>
                            <p className="mb-2 text-sm font-medium">
                                {t('adminNodes.createPage_location')}
                            </p>
                            <Listbox
                                value={locationId}
                                onChange={setLocationId}
                                disabled={busy || loading || !regionId}
                            >
                                <div className="relative">
                                    <ListboxButton className={selectClasses}>
                                        <span className="truncate">
                                            {availableLocations.find((location) => location.id === locationId)?.name ??
                                                t('adminNodes.createPage_selectLocation')}
                                        </span>
                                        <ChevronDown size={17} aria-hidden="true" />
                                    </ListboxButton>
                                    <ListboxOptions anchor="bottom start" className={optionsClasses}>
                                        {availableLocations.map((location) => (
                                            <ListboxOption
                                                key={location.id}
                                                value={location.id}
                                                className={optionClasses}
                                            >
                                                {location.name} ({location.code})
                                            </ListboxOption>
                                        ))}
                                    </ListboxOptions>
                                </div>
                            </Listbox>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-border-subtle bg-surface p-6">
                    <h2 className="text-lg font-semibold">
                        {t('adminNodes.createPage_allocation')}
                    </h2>
                    <p className="mt-2 text-sm text-text-secondary">
                        {t('adminNodes.createPage_allocationDescription')}
                    </p>

                    <div className="mt-5 space-y-4">
                        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border-subtle p-4">
                            <span>
                                <span className="block font-medium">
                                    {t('adminNodes.createPage_manual')}
                                </span>
                                <span className="mt-1 block text-sm text-text-secondary">
                                    {t('adminNodes.createPage_manualDescription')}
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
                                <span className="block font-medium">
                                    {t('adminNodes.createPage_automatic')}
                                </span>
                                <span className="mt-1 block text-sm text-text-secondary">
                                    {t('adminNodes.createPage_automaticDescription')}
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

                {error && (
                    <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                        {error}
                    </p>
                )}

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={
                            busy ||
                            loading ||
                            !name.trim() ||
                            !regions.some((region) => region.id === regionId) ||
                            !availableLocations.some((location) => location.id === locationId)
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50"
                    >
                        <Plus size={18} aria-hidden="true" />
                        {busy
                            ? t('adminNodes.createPage_creating')
                            : t('adminNodes.createPage_title')}
                    </button>
                </div>
            </form>

            {credentials && (
                <NodeTokenDialog
                    credentials={credentials}
                    onClose={() => navigate('/admin/nodes')}
                />
            )}
        </div>
    );
};
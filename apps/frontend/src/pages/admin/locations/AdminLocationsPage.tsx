import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { Info, MapPin, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import type {
  CreateLocationRequest,
  LocationRecord,
  RegionRecord,
} from '@shared/types';
import { locationsApi } from '@/features/locations/api/locationsApi';
import { regionsApi } from '@/features/regions/api/regionsApi';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useAuthStore } from '@/app/store/auth.store';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';

type LocationForm = {
  name: string;
  code: string;
  continent: string;
  country: string;
  state: string;
  city: string;
  regionId: string;
};

const emptyForm: LocationForm = {
  name: '',
  code: '',
  continent: '',
  country: '',
  state: '',
  city: '',
  regionId: '',
};

const getApiError = (error: unknown): string | null => {
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

type LocationFieldInfoProps = {
  text: string;
  title: string;
};

const LocationFieldInfo = ({ text, title }: LocationFieldInfoProps) => (
  <span className="group relative inline-flex items-center">
    <button
      type="button"
      aria-label={title}
      className="rounded-full p-1 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Info size={16} aria-hidden="true" />
    </button>
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-64 max-w-[80vw] rounded-xl border border-white/15 bg-[#17243a] p-3 text-left text-xs leading-relaxed text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
    >
      {text}
    </span>
  </span>
);
export const AdminLocationsPage = () => {
  const { t } = useTranslation();
  const canReadRegions = useAuthStore((state) =>
    !!state.user?.permissions?.includes('region:manage'),
  );

  const label = (key: string, fallback: string) =>
    t(`adminLocations.${key}`, { defaultValue: fallback });

  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [regions, setRegions] = useState<RegionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<LocationForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [locationToDelete, setLocationToDelete] =
    useState<LocationRecord | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [initialForm, setInitialForm] = useState<LocationForm>(emptyForm);
  const unsaved = useUnsavedChanges(showForm && JSON.stringify(form) !== JSON.stringify(initialForm));
  const beginForm = (value: LocationForm) => { setForm(value); setInitialForm(value); };

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);

      try {
        const [locationResult, regionResult] = await Promise.all([
          locationsApi.list(controller.signal),
          canReadRegions ? regionsApi.list(controller.signal) : Promise.resolve([]),
        ]);

        if (!controller.signal.aborted) {
          setLocations(locationResult);
          setRegions(regionResult);
          setError('');
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(
            getApiError(reason) ??
            label('unexpectedError', 'Nie udało się pobrać lokalizacji.'),
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => controller.abort();
    // Refresh is triggered explicitly after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, canReadRegions]);

  const startCreate = () => {
    beginForm({
      ...emptyForm,
      regionId: regions.length === 1 ? regions[0].id : '',
    });
    setEditingId(null);
    setError('');
    setNotice('');
    setShowForm(true);
  };

  const startEdit = (location: LocationRecord) => {
    beginForm({
      name: location.name,
      code: location.code,
      continent: location.continent,
      country: location.country,
      state: location.state ?? '',
      city: location.city ?? '',
      regionId: location.regionId,
    });
    setEditingId(location.id);
    setError('');
    setNotice('');
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const saveLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = form.name.trim();
    const code = form.code.trim();
    const continent = form.continent.trim();
    const country = form.country.trim();
    const state = form.state.trim();
    const city = form.city.trim();
    const regionId = form.regionId.trim();

    if (!name || name.length > 100) {
      setError(label('invalidName', 'Nazwa musi mieć od 1 do 100 znaków.'));
      return;
    }

    if (
      code.length < 2 ||
      code.length > 50 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)
    ) {
      setError(
        label('invalidCode', 'Kod musi mieć 2–50 znaków: małe litery, cyfry i myślniki.'),
      );
      return;
    }

    if (
      continent.length < 2 ||
      continent.length > 100 ||
      country.length < 2 ||
      country.length > 100
    ) {
      setError(
        label('invalidGeography', 'Kontynent i kraj muszą mieć od 2 do 100 znaków.'),
      );
      return;
    }

    if ((state && state.length > 100) || (city && city.length > 100)) {
      setError(
        label('invalidOptional', 'Województwo/stan i miasto mogą mieć maksymalnie 100 znaków.'),
      );
      return;
    }

    if (!regionId || (canReadRegions
      ? !regions.some((region) => region.id === regionId)
      : regionId !== locations.find((location) => location.id === editingId)?.regionId)) {
      setError(label('invalidRegion', 'Wybierz istniejący region.'));
      return;
    }

    const payload: CreateLocationRequest = {
      name,
      code,
      continent,
      country,
      state: state || null,
      city: city || null,
      regionId,
    };

    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (editingId) {
        await locationsApi.update(editingId, payload);
      } else {
        await locationsApi.create(payload);
      }

      setNotice(
        editingId
          ? label('updated', 'Lokalizacja została zaktualizowana.')
          : label('created', 'Lokalizacja została utworzona.'),
      );
      cancelForm();
      refresh();
    } catch (reason) {
      setError(
        getApiError(reason) ??
        label('unexpectedError', 'Nie udało się wykonać operacji.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteLocation = (location: LocationRecord) => {
    setError('');
    setNotice('');
    setLocationToDelete(location);
  };

  const confirmDeleteLocation = async () => {
    if (!locationToDelete || busy) return;

    const location = locationToDelete;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      await locationsApi.remove(location.id);
      setLocationToDelete(null);
      setNotice(label('deleted', 'Lokalizacja została usunięta.'));
      refresh();
    } catch (reason) {
      setError(
        getApiError(reason) ??
        label('unexpectedError', 'Nie udało się usunąć lokalizacji.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const regionName = (regionId: string) =>
    regions.find((region) => region.id === regionId)?.name ??
    label('unknownRegion', 'Nieznany region');

  const inputClass =
    'w-full rounded-xl border border-border-subtle bg-transparent px-4 py-3';

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={locationToDelete !== null}
        title={label('deleteTitle', 'Usuń lokalizację')}
        description={
          locationToDelete
            ? t('adminLocations.confirmDelete', {
              name: locationToDelete.name,
              defaultValue: `Czy na pewno usunąć lokalizację „${locationToDelete.name}”?`,
            })
            : ''
        }
        confirmLabel={label('delete', 'Usuń')}
        onConfirm={() => void confirmDeleteLocation()}
        onCancel={() => {
          if (!busy) setLocationToDelete(null);
        }}
        busy={busy}
        destructive
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">
            {label('administration', 'Administracja / Infrastruktura')}
          </p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold">
            <MapPin size={28} aria-hidden="true" />
            {label('title', 'Lokalizacje')}
          </h1>
          <p className="mt-2 text-text-secondary">
            {label('description', 'Zarządzaj lokalizacjami infrastruktury i ich regionami.')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={loading || busy}
            className="inline-flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2 hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw size={17} aria-hidden="true" />
            {label('refresh', 'Odśwież')}
          </button>

          <button
            type="button"
            onClick={() => unsaved.requestAction(startCreate)}
            disabled={loading || busy || regions.length === 0}
            title={
              !canReadRegions
                ? label('regionPermissionRequired', 'Wymagane uprawnienie do odczytu regionów.')
                : regions.length === 0
                  ? label('noRegions', 'Najpierw utwórz region.')
                  : undefined
            }
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            <Plus size={17} aria-hidden="true" />
            {label('add', 'Dodaj lokalizację')}
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

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300"
        >
          {notice}
        </p>
      )}

      {!loading && regions.length === 0 && (
        <p className="rounded-xl border border-border-subtle bg-surface p-4 text-text-secondary">
          {canReadRegions
            ? label('noRegions', 'Najpierw utwórz region.')
            : label('regionPermissionRequired', 'Wymagane uprawnienie do odczytu regionów.')}
        </p>
      )}

      {showForm && (
        <section className="rounded-2xl border border-border-subtle bg-surface p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {editingId
                ? label('editTitle', 'Edytuj lokalizację')
                : label('addTitle', 'Nowa lokalizacja')}
            </h2>
            <button
              type="button"
              onClick={() => unsaved.requestAction(cancelForm)}
              disabled={busy}
              aria-label={label('cancel', 'Anuluj')}
              className="rounded-lg p-2 hover:bg-white/5 disabled:opacity-50"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <form
            onSubmit={(event) => void saveLocation(event)}
            className="mt-5 space-y-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="block text-sm">
                  {label('name', 'Nazwa lokalizacji')}
                  <LocationFieldInfo
                    title={label('infoTitle', 'Informacje o polu')}
                    text={label('info_name', '')}
                  />
                </span>
                <input
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  disabled={busy}
                  placeholder={label('exampleName', 'Warszawa DC1')}
                  className={inputClass}
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm">
                  {label('code', 'Kod lokalizacji')}
                  <LocationFieldInfo
                    title={label('infoTitle', 'Informacje o polu')}
                    text={label('info_code', '')}
                  />
                </span>
                <input
                  required
                  minLength={2}
                  maxLength={50}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, code: event.target.value }))
                  }
                  disabled={busy}
                  placeholder={label('exampleCode', 'waw-dc1')}
                  className={inputClass}
                />
              </label>

              <div className="space-y-2">
                <span className="block text-sm" id="location-region-label">
                  {label('region', 'Region')}
                  <LocationFieldInfo
                    title={label('infoTitle', 'Informacje o polu')}
                    text={label('info_region', '')}
                  />
                </span>
                <Listbox
                  value={form.regionId}
                  onChange={(regionId: string) =>
                    setForm((current) => ({ ...current, regionId }))
                  }
                  disabled={busy || !canReadRegions}
                >
                  <div className="relative">
                    <ListboxButton
                      aria-label={label('region', 'Region')}
                      className={`${inputClass} flex items-center justify-between gap-3 bg-surface text-left text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50`}
                    >
                      <span className="truncate">
                        {regions.find((region) => region.id === form.regionId)
                          ? `${regions.find((region) => region.id === form.regionId)!.name} (${regions.find((region) => region.id === form.regionId)!.code})`
                          : form.regionId || label('selectRegion', 'Wybierz region')}
                      </span>
                      <span aria-hidden="true" className="text-text-secondary">⌄</span>
                    </ListboxButton>

                    <ListboxOptions
                      anchor="bottom start"
                      className="z-50 mt-1 max-h-64 w-[var(--button-width)] overflow-y-auto rounded-xl border border-border-subtle bg-[#17243a] p-1 text-white shadow-2xl [--anchor-gap:4px] focus:outline-none"
                    >
                      {regions.map((region) => (
                        <ListboxOption
                          key={region.id}
                          value={region.id}
                          className="cursor-pointer rounded-lg px-3 py-2 text-sm text-white outline-none data-[focus]:bg-white/15 data-[selected]:bg-primary/20"
                        >
                          {region.name} ({region.code})
                        </ListboxOption>
                      ))}
                    </ListboxOptions>
                  </div>
                </Listbox>
                <input
                  type="text"
                  required
                  tabIndex={-1}
                  aria-hidden="true"
                  value={form.regionId}
                  onChange={() => { }}
                  className="pointer-events-none absolute h-px w-px opacity-0"
                />
              </div>

              <label className="space-y-2">
                <span className="block text-sm">
                  {label('continent', 'Kontynent')}
                  <LocationFieldInfo
                    title={label('infoTitle', 'Informacje o polu')}
                    text={label('info_continent', '')}
                  />
                </span>
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.continent}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      continent: event.target.value,
                    }))
                  }
                  disabled={busy}
                  placeholder={label('exampleContinent', 'Europa')}
                  className={inputClass}
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm">
                  {label('country', 'Kraj')}
                  <LocationFieldInfo
                    title={label('infoTitle', 'Informacje o polu')}
                    text={label('info_country', '')}
                  />
                </span>
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.country}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      country: event.target.value,
                    }))
                  }
                  disabled={busy}
                  placeholder={label('exampleCountry', 'Polska')}
                  className={inputClass}
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm">
                  {label('state', 'Województwo / stan (opcjonalnie)')}
                  <LocationFieldInfo
                    title={label('infoTitle', 'Informacje o polu')}
                    text={label('info_state', '')}
                  />
                </span>
                <input
                  maxLength={100}
                  value={form.state}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      state: event.target.value,
                    }))
                  }
                  disabled={busy}
                  placeholder={label('exampleState', 'Mazowieckie')}
                  className={inputClass}
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm">
                  {label('city', 'Miasto (opcjonalnie)')}
                  <LocationFieldInfo
                    title={label('infoTitle', 'Informacje o polu')}
                    text={label('info_city', '')}
                  />
                </span>
                <input
                  maxLength={100}
                  value={form.city}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      city: event.target.value,
                    }))
                  }
                  disabled={busy}
                  placeholder={label('exampleCity', 'Warszawa')}
                  className={inputClass}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                {busy
                  ? label('saving', 'Zapisywanie...')
                  : label('save', 'Zapisz lokalizację')}
              </button>
              <button
                type="button"
                onClick={() => unsaved.requestAction(cancelForm)}
                disabled={busy}
                className="rounded-xl border border-border-subtle px-5 py-3 disabled:opacity-50"
              >
                {label('cancel', 'Anuluj')}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-5">
          <h2 className="text-lg font-semibold">
            {label('listTitle', 'Lista lokalizacji')}
          </h2>
          <span className="text-sm text-text-secondary">
            {t('adminLocations.count', {
              count: locations.length,
              defaultValue: 'Lokalizacje: {{count}}',
            })}
          </span>
        </div>

        {loading ? (
          <p className="p-6 text-text-secondary">
            {label('loading', 'Ładowanie lokalizacji...')}
          </p>
        ) : locations.length === 0 ? (
          <p className="p-6 text-text-secondary">
            {label('empty', 'Nie utworzono jeszcze żadnej lokalizacji.')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-subtle text-text-secondary">
                <tr>
                  <th scope="col" className="p-4">{label('name', 'Nazwa')}</th>
                  <th scope="col" className="p-4">{label('code', 'Kod')}</th>
                  <th scope="col" className="p-4">{label('region', 'Region')}</th>
                  <th scope="col" className="p-4">{label('continent', 'Kontynent')}</th>
                  <th scope="col" className="p-4">{label('country', 'Kraj')}</th>
                  <th scope="col" className="p-4">{label('city', 'Miasto')}</th>
                  <th scope="col" className="p-4">{label('actions', 'Akcje')}</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((location) => (
                  <tr
                    key={location.id}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <td className="p-4 font-semibold">{location.name}</td>
                    <td className="p-4 font-mono text-xs">{location.code}</td>
                    <td className="p-4">{regionName(location.regionId)}</td>
                    <td className="p-4">{location.continent}</td>
                    <td className="p-4">{location.country}</td>
                    <td className="p-4">{location.city ?? '—'}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => unsaved.requestAction(() => startEdit(location))}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 hover:bg-white/5 disabled:opacity-50"
                        >
                          <Pencil size={15} aria-hidden="true" />
                          {label('edit', 'Edytuj')}
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteLocation(location)}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          {label('delete', 'Usuń')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe2, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import type { RegionRecord } from '@shared/types';
import { regionsApi } from '@/features/regions/api/regionsApi';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';

type RegionForm = {
  name: string;
  code: string;
  description: string;
};

const emptyForm: RegionForm = {
  name: '',
  code: '',
  description: '',
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

export const AdminRegionsPage = () => {
  const { t } = useTranslation();

  const label = (key: string, fallback: string) =>
    t(`adminRegions.${key}`, { defaultValue: fallback });

  const [regions, setRegions] = useState<RegionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<RegionForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [regionToDelete, setRegionToDelete] = useState<RegionRecord | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [initialForm, setInitialForm] = useState<RegionForm>(emptyForm);
  const unsaved = useUnsavedChanges(showForm && JSON.stringify(form) !== JSON.stringify(initialForm));
  const beginForm = (value: RegionForm) => { setForm(value); setInitialForm(value); };

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);

      try {
        const result = await regionsApi.list(controller.signal);

        if (!controller.signal.aborted) {
          setRegions(result);
          setError('');
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(
            getApiError(reason) ??
            label('unexpectedError', 'Nie udało się pobrać regionów.'),
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
    // A refresh is triggered explicitly after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const startCreate = () => {
    beginForm(emptyForm);
    setEditingId(null);
    setError('');
    setNotice('');
    setShowForm(true);
  };

  const startEdit = (region: RegionRecord) => {
    beginForm({
      name: region.name,
      code: region.code,
      description: region.description ?? '',
    });
    setEditingId(region.id);
    setError('');
    setNotice('');
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const saveRegion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = form.name.trim();
    const code = form.code.trim();
    const description = form.description.trim();

    if (!name || name.length > 100) {
      setError(label('invalidName', 'Nazwa musi mieć od 1 do 100 znaków.'));
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code) || code.length > 50) {
      setError(
        label(
          'invalidCode',
          'Kod musi mieć 2–50 znaków: małe litery, cyfry i myślniki.',
        ),
      );
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (editingId) {
        await regionsApi.update(editingId, {
          name,
          code,
          description: description || null,
        });
      } else {
        await regionsApi.create({
          name,
          code,
          ...(description ? { description } : {}),
        });
      }

      setNotice(
        editingId
          ? label('updated', 'Region został zaktualizowany.')
          : label('created', 'Region został utworzony.'),
      );
      cancelForm();
      refresh();
    } catch (reason) {
      setError(
        getApiError(reason) ??
        label('unexpectedError', 'Wystąpił nieoczekiwany błąd.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteRegion = (region: RegionRecord) => {
    if (region._count.locations > 0 || region._count.nodes > 0) {
      setError(
        label(
          'deleteBlocked',
          'Nie można usunąć regionu z przypisanymi lokalizacjami lub węzłami.',
        ),
      );
      return;
    }

    setError('');
    setNotice('');
    setRegionToDelete(region);
  };

  const confirmDeleteRegion = async () => {
    if (!regionToDelete || busy) return;

    const region = regionToDelete;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      await regionsApi.remove(region.id);
      setRegionToDelete(null);
      setNotice(label('deleted', 'Region został usunięty.'));
      refresh();
    } catch (reason) {
      setError(
        getApiError(reason) ??
        label('unexpectedError', 'Wystąpił nieoczekiwany błąd.'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={regionToDelete !== null}
        title={label('delete', 'Usuń')}
        description={
          regionToDelete
            ? t('adminRegions.confirmDelete', {
              name: regionToDelete.name,
              defaultValue: `Czy na pewno usunąć region „${regionToDelete.name}”?`,
            })
            : ''
        }
        confirmLabel={label('delete', 'Usuń')}
        onConfirm={() => void confirmDeleteRegion()}
        onCancel={() => {
          if (!busy) setRegionToDelete(null);
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
            <Globe2 size={28} aria-hidden="true" />
            {label('title', 'Regiony')}
          </h1>
          <p className="mt-2 text-text-secondary">
            {label(
              'description',
              'Zarządzaj regionami infrastruktury i przypisanymi lokalizacjami.',
            )}
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
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            <Plus size={17} aria-hidden="true" />
            {label('add', 'Dodaj region')}
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

      {showForm && (
        <section className="rounded-2xl border border-border-subtle bg-surface p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {editingId
                ? label('editTitle', 'Edytuj region')
                : label('addTitle', 'Nowy region')}
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

          <form onSubmit={(event) => void saveRegion(event)} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="block text-sm">
                  {label('name', 'Nazwa regionu')}
                </span>
                <input
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  disabled={busy}
                  placeholder="Europa"
                  className="w-full rounded-xl border border-border-subtle bg-transparent px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm">
                  {label('code', 'Kod regionu')}
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
                  placeholder="eu"
                  className="w-full rounded-xl border border-border-subtle bg-transparent px-4 py-3"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="block text-sm">
                {label('regionDescription', 'Opis (opcjonalnie)')}
              </span>
              <textarea
                maxLength={500}
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                disabled={busy}
                className="w-full rounded-xl border border-border-subtle bg-transparent px-4 py-3"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                {busy
                  ? label('saving', 'Zapisywanie...')
                  : label('save', 'Zapisz region')}
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
            {label('listTitle', 'Lista regionów')}
          </h2>
          <span className="text-sm text-text-secondary">
            {t('adminRegions.count', {
              count: regions.length,
              defaultValue: 'Regiony: {{count}}',
            })}
          </span>
        </div>

        {loading ? (
          <p className="p-6 text-text-secondary">
            {label('loading', 'Ładowanie regionów...')}
          </p>
        ) : regions.length === 0 ? (
          <p className="p-6 text-text-secondary">
            {label('empty', 'Nie utworzono jeszcze żadnego regionu.')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-subtle text-text-secondary">
                <tr>
                  <th scope="col" className="p-4">{label('name', 'Nazwa')}</th>
                  <th scope="col" className="p-4">{label('code', 'Kod')}</th>
                  <th scope="col" className="p-4">{label('locations', 'Lokalizacje')}</th>
                  <th scope="col" className="p-4">{label('nodes', 'Węzły')}</th>
                  <th scope="col" className="p-4">{label('actions', 'Akcje')}</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((region) => {
                  const assigned =
                    region._count.locations > 0 || region._count.nodes > 0;

                  return (
                    <tr
                      key={region.id}
                      className="border-b border-border-subtle last:border-0"
                    >
                      <td className="p-4">
                        <p className="font-semibold">{region.name}</p>
                        {region.description && (
                          <p className="mt-1 text-xs text-text-secondary">
                            {region.description}
                          </p>
                        )}
                      </td>
                      <td className="p-4 font-mono text-xs">{region.code}</td>
                      <td className="p-4">{region._count.locations}</td>
                      <td className="p-4">{region._count.nodes}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => unsaved.requestAction(() => startEdit(region))}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 hover:bg-white/5 disabled:opacity-50"
                          >
                            <Pencil size={15} aria-hidden="true" />
                            {label('edit', 'Edytuj')}
                          </button>

                          <button
                            type="button"
                            onClick={() => void deleteRegion(region)}
                            disabled={busy || assigned}
                            title={
                              assigned
                                ? label(
                                  'deleteBlocked',
                                  'Region ma przypisane lokalizacje lub węzły.',
                                )
                                : undefined
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                            {label('delete', 'Usuń')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/app/store/auth.store';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';
import { nodesApi, type NodeRecord } from '@/features/nodes/api/nodesApi';
import { adminServicesApi, type AdminService, type ServiceEggOption } from '../api/adminServicesApi';
import { emptyServiceForm, getServiceErrorMessage, toCreateServicePayload, type ServiceFormValues } from '../lib/serviceForm';
import { ServiceOwnerPicker } from './ServiceOwnerPicker';

type Draft = ServiceFormValues & { eggId: string; profileId: string; runtimeVersion: string };
const draftFrom = (service?: AdminService): Draft => ({ ...emptyServiceForm(),
  ...(service ? { name: service.name, categoryKey: service.category.key, nodeId: service.nodeId ?? '',
    memoryMb: String(service.memoryMb ?? ''), cpuPercent: String(service.cpuPercent ?? ''), diskMb: String(service.diskMb ?? '') } : {}),
  eggId: service?.eggId ?? '',
  profileId: service?.eggConfiguration?.profileId ?? '', runtimeVersion: service?.eggConfiguration?.runtimeVersion ?? '',
});

export const AdminServiceEditor = ({ service }: { service?: AdminService }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canReadNodes = !!permissions?.includes('node:read');
  const [form, setForm] = useState<Draft>(() => draftFrom(service));
  const [baseline] = useState(() => JSON.stringify(draftFrom(service)));
  const [eggs, setEggs] = useState<ServiceEggOption[]>([]);
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const unsaved = useUnsavedChanges(JSON.stringify(form) !== baseline);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([adminServicesApi.eggs(controller.signal), canReadNodes ? nodesApi.list(controller.signal) : Promise.resolve([])])
      .then(([available, infrastructure]) => { if (!controller.signal.aborted) { setEggs(available); setNodes(infrastructure); } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setOptionsError(getServiceErrorMessage(reason, t('adminServices.unexpectedError'))); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [canReadNodes, t]);
  const selectedEgg = eggs.find((egg) => egg.id === form.eggId);
  const catalog = selectedEgg?.manifest.catalog;
  const profile = catalog?.profiles.find((entry) => entry.id === (form.profileId || catalog.defaultProfile));
  const runtimeVersion = form.runtimeVersion || profile?.runtimeVersion || catalog?.defaultVersion;
  const runtimePreview = catalog?.versions.find((entry) => entry.version === runtimeVersion)?.image ?? selectedEgg?.manifest.runtime.image;
  const startup = profile?.startup ?? catalog?.startup;
  const startupPreview = startup ? (startup.mode === 'npm-start' ? 'npm start' : `${startup.mode === 'node-file' ? 'node' : 'python'} ${startup.entrypoint}`) : selectedEgg?.manifest.runtime.startup;
  const setField = (key: keyof Draft, value: string | number | null) => setForm((previous) => ({ ...previous, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || loading || !permissions?.includes(service ? 'service:manage:any' : 'service:create')) return;
    setSaving(true); setError('');
    try {
      const payload = toCreateServicePayload(form);
      if (payload.cpuPercent !== undefined && payload.cpuPercent > 100) throw new Error(t('adminServices.installationCpuLimit'));
      const result = service ? await adminServicesApi.update(service.id, {
        name: payload.name, categoryKey: payload.categoryKey, nodeId: form.nodeId || null,
        eggId: form.eggId || null, memoryMb: payload.memoryMb, cpuPercent: payload.cpuPercent, diskMb: payload.diskMb,
        expectedUpdatedAt: service.updatedAt,
        ...(catalog ? { profileId: form.profileId, runtimeVersion: form.runtimeVersion } : {}),
      }) : await adminServicesApi.createDraft({ ...payload, ...(form.eggId ? { eggId: form.eggId } : {}),
        ...(form.profileId ? { profileId: form.profileId } : {}), ...(form.runtimeVersion ? { runtimeVersion: form.runtimeVersion } : {}) });
      unsaved.markSaved(); navigate(`/admin/services/${result.id}`);
    } catch (reason) { setError(getServiceErrorMessage(reason, t('adminServices.unexpectedError'))); }
    finally { setSaving(false); }
  };
  const field = 'w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 disabled:opacity-50';
  return <form onSubmit={(event) => void submit(event)} className="space-y-6 rounded-2xl border border-border-subtle bg-surface p-6">
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {optionsError && <p role="alert" className="text-amber-300">{optionsError}</p>}
    {service?.eggId && service.eggId !== form.eggId && <p role="status" className="text-amber-300">{t('adminServices.eggChangeClearsEnvironment')}</p>}
    <fieldset disabled={saving} className="grid gap-5 md:grid-cols-2">
      <legend className="mb-4 text-lg font-semibold">{t('adminServices.configuration')}</legend>
      <label className="space-y-2"><span>{t('adminServices.name')}</span><input className={field} required maxLength={100} value={form.name} onChange={(event) => setField('name', event.target.value)} /></label>
      <label className="space-y-2"><span>{t('adminServices.category')}</span><select className={field} value={form.categoryKey}
        onChange={(event) => setForm((previous) => ({ ...previous, categoryKey: event.target.value, eggId: '', profileId: '', runtimeVersion: '' }))}>
        {['server', 'discord_bot', 'telegram_bot', 'other'].map((key) => <option key={key} value={key}>{t(`adminServices.categories.${key}`)}</option>)}
      </select></label>
      {!service && permissions?.includes('user:read') && <div className="space-y-2"><span>{t('adminServices.ownerOptional')}</span><ServiceOwnerPicker value={form.ownerId} onChange={(value) => setField('ownerId', value)} disabled={saving} /></div>}
      <label className="space-y-2"><span>{t('adminServices.nodeOptional')}</span><select className={field} value={form.nodeId} disabled={!canReadNodes || loading} onChange={(event) => setField('nodeId', event.target.value)}>
        <option value="">{t('adminServices.unassigned')}</option>
        {form.nodeId && !nodes.some((node) => node.id === form.nodeId) && <option value={form.nodeId}>{form.nodeId}</option>}
        {nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
      </select></label>
      <label className="space-y-2 md:col-span-2"><span>Egg</span><select className={field} value={form.eggId} disabled={loading} onChange={(event) => setForm((previous) => ({ ...previous, eggId: event.target.value, profileId: '', runtimeVersion: '' }))}>
        <option value="">{t('adminServices.noEgg')}</option>
        {form.eggId && !eggs.some((egg) => egg.id === form.eggId) && <option value={form.eggId}>{service?.egg?.name ?? form.eggId}</option>}
        {eggs.filter((egg) => egg.manifest.category === form.categoryKey).map((egg) => <option key={egg.id} value={egg.id}>{egg.name} — {egg.version}</option>)}
      </select></label>
      {selectedEgg?.manifest.catalog && <>
        <label className="space-y-2"><span>{t('adminServices.eggProfile')}</span><select className={field} value={form.profileId} onChange={(event) => setForm((previous) => ({ ...previous, profileId: event.target.value, runtimeVersion: '' }))}>
          <option value="">{t('adminServices.eggDefault')}</option>{selectedEgg.manifest.catalog.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </select></label>
        <label className="space-y-2"><span>{t('adminServices.runtimeVersion')}</span><select className={field} value={form.runtimeVersion} onChange={(event) => setField('runtimeVersion', event.target.value)}>
          <option value="">{t('adminServices.eggDefault')}</option>{selectedEgg.manifest.catalog.versions.map((runtime) => <option key={runtime.version} value={runtime.version}>{runtime.version} — {runtime.image}</option>)}
        </select></label>
        <p className="text-sm text-amber-300 md:col-span-2">{t('eggs.contractV2Required')}</p>
      </>}
      {(['memoryMb', 'cpuPercent', 'diskMb'] as const).map((key) => <label key={key} className="space-y-2"><span>{t(`adminServices.resources.${key}`)}</span><input className={field} type="number" min={1} step={1} value={form[key]} onChange={(event) => setField(key, event.target.value)} /></label>)}
      {selectedEgg && <section className="space-y-3 rounded-xl border border-border-subtle p-4 md:col-span-2">
        <p className="font-mono text-sm break-all">{runtimePreview}</p>
        <p className="font-mono text-sm break-all">{startupPreview}</p>
        <button type="button" className="rounded-lg border border-border-subtle px-3 py-2" onClick={() => unsaved.requestAction(() => setForm((previous) => ({ ...previous,
          memoryMb: String(selectedEgg.manifest.resources.memoryMb), cpuPercent: String(selectedEgg.manifest.resources.cpuPercent), diskMb: String(selectedEgg.manifest.resources.diskMb),
        })))}>{t('adminServices.applyEggDefaults')}</button>
        {(selectedEgg.manifest.variables ?? []).map((variable) => <p key={variable.name} className="text-sm">{variable.name} — {t(variable.secret ? 'adminServices.secretVariable' : 'adminServices.variable')} {variable.required ? '*' : ''}</p>)}
      </section>}
    </fieldset>
    <p className="text-sm text-text-secondary">{t('adminServices.draftDescription')}</p>
    <div className="flex gap-3"><button className="rounded-xl bg-primary px-5 py-3 text-white disabled:opacity-50" disabled={saving || loading}>{t(saving ? 'common.saving' : 'common.save')}</button>
      <button type="button" className="rounded-xl border border-border-subtle px-5 py-3" disabled={saving} onClick={() => navigate(service ? `/admin/services/${service.id}` : '/admin/services')}>{t('common.cancel')}</button></div>
  </form>;
};

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/app/store/auth.store';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { AdminServiceHeader } from '@/features/services/components/AdminServiceHeader';
import { ServiceStatus } from '@/features/services/components/ServiceStatus';
import { ServiceInstallationReadiness } from '@/features/services/components/ServiceInstallationReadiness';
import { adminServicesApi, type AdminServiceJob } from '@/features/services/api/adminServicesApi';
import { useAdminService } from '@/features/services/hooks/useAdminService';
import { getServiceErrorMessage } from '@/features/services/lib/serviceForm';

export const AdminServiceInstallationPage = () => {
  const { id } = useParams(); const { t } = useTranslation(); const { service, error, loading, refresh } = useAdminService(id);
  const canInstall = useAuthStore((state) => !!state.user?.permissions?.includes('service:install:any'));
  const [job, setJob] = useState<AdminServiceJob | null>(null); const [actionError, setError] = useState('');
  const [history, setHistory] = useState<AdminServiceJob[]>([]); const hadActive = useRef(false);
  const [installationReady, setInstallationReady] = useState(false);
  const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false); const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (!id) return; const controller = new AbortController();
    let inFlight = false;
    const load = async () => { if (inFlight) return; inFlight = true;
      await Promise.all([adminServicesApi.activeJob(id, controller.signal), adminServicesApi.jobs(id, controller.signal)]).then(([value, jobs]) => { if (!controller.signal.aborted) {
        if (hadActive.current && !value) refresh(); hadActive.current = !!value;
        setJob(value); setHistory(jobs); setError('');
      } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(getServiceErrorMessage(reason, t('adminServices.unexpectedError'))); })
      .finally(() => { inFlight = false; if (!controller.signal.aborted) setChecking(false); }); };
    void load(); const interval = window.setInterval(() => void load(), 5000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [id, t, refresh]);
  const install = async () => {
    if (!service || !id || busy || !canInstall || job || checking) return;
    setBusy(true);
    try { setJob(await adminServicesApi.install(id, service.installStatus === 'DRAFT')); hadActive.current = true; setConfirm(false); refresh(); }
    catch (reason) { setConfirm(false); setError(getServiceErrorMessage(reason, t('adminServices.unexpectedError'))); }
    finally { setBusy(false); }
  };
  return <div className="space-y-6"><AdminServiceHeader title={t('adminServices.installation')} id={id} />
    {(error || actionError) && <p role="alert">{error || actionError}</p>}
    {(loading || checking) && <p role="status">{t('common.loading')}</p>}
    {id && <ServiceInstallationReadiness serviceId={id} onReady={setInstallationReady} />}
    {service && <section className="space-y-4 rounded-2xl border border-border-subtle p-6"><ServiceStatus kind="installation" status={service.installStatus} />
      <p>{service.egg?.name ?? t('adminServices.noEgg')} — {service.egg?.version}</p>
      {job && <p role="status">{job.status} — {job.progress}%</p>}
      {canInstall && <button className="rounded-xl bg-primary px-5 py-3 text-white disabled:opacity-50"
        disabled={!installationReady || busy || checking || !!actionError || !!job || !service.eggId || !service.nodeId || !!service.egg?.manifest.catalog || !['DRAFT', 'FAILED'].includes(service.installStatus)} onClick={() => setConfirm(true)}>{t('adminServices.install')}</button>}
    </section>}
    {history.length > 0 && <section className="space-y-3 rounded-2xl border border-border-subtle p-6"><h2 className="text-lg font-semibold">{t('adminServices.jobHistory')}</h2>
      {history.map((entry) => <p key={entry.id} className="text-sm">#{entry.id} · {entry.status} · {entry.progress}% · {new Date(entry.createdAt).toLocaleString()}</p>)}
    </section>}
    <ConfirmDialog open={confirm} title={t('adminServices.install')} description={t('adminServices.confirmInstall')} confirmLabel={t('adminServices.install')} busy={busy} onCancel={() => { if (!busy) setConfirm(false); }} onConfirm={() => void install()} />
  </div>;
};

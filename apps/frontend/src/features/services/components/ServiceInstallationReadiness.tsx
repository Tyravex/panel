import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminServicesApi } from '../api/adminServicesApi';
import { getApiErrorMessage } from '@/shared/lib/getApiErrorMessage';

export const ServiceInstallationReadiness = ({ serviceId, onReady }: { serviceId: string; onReady?: (ready: boolean) => void }) => {
  const { t } = useTranslation();
  const [readiness, setReadiness] = useState<Awaited<ReturnType<typeof adminServicesApi.compatibility>> | null>(null);
  const [updates, setUpdates] = useState<Awaited<ReturnType<typeof adminServicesApi.updates>>>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true; onReady?.(false);
    void Promise.all([adminServicesApi.compatibility(serviceId), adminServicesApi.updates(serviceId)])
      .then(([status, versions]) => { if (active) { setReadiness(status); setUpdates(versions); onReady?.(status.ready); } })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason)); });
    return () => { active = false; };
  }, [serviceId, onReady]);
  return <section className="space-y-3 rounded-2xl border border-border-subtle p-6"><h2 className="text-xl font-semibold">{t('adminServices.installationReadiness')}</h2>
    {error && <p role="alert">{error}</p>}
    {!readiness && !error && <p role="status">{t('common.loading')}</p>}
    {readiness && <><ul className="space-y-2">{readiness.blockers.map((blocker) => <li className="text-amber-300" key={blocker}>{t(`adminServices.installationBlockers.${blocker}`)}</li>)}</ul>
      {!!readiness.missingVariables.length && <p className="font-mono text-sm">{readiness.missingVariables.join(', ')}</p>}
    </>}
    {!!updates.length && <div className="space-y-2"><h3 className="font-semibold">{t('adminServices.availableEggUpdates')}</h3><p className="text-sm text-text-secondary">{t('adminServices.manualEggUpdates')}</p>
      {updates.map((egg) => <Link className="block text-primary" key={egg.id} to={`/admin/eggs/${egg.id}`}>{egg.name} · {egg.version}</Link>)}
    </div>}
  </section>;
};

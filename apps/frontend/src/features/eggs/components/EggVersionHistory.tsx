import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { eggsApi } from '../api/eggsApi';
import { getApiErrorMessage } from '@/shared/lib/getApiErrorMessage';

export const EggVersionHistory = ({ eggId }: { eggId: string }) => {
  const { t } = useTranslation(); const [rows, setRows] = useState<Awaited<ReturnType<typeof eggsApi.versions>>>([]); const [error, setError] = useState('');
  useEffect(() => { let active = true; void eggsApi.versions(eggId).then((values) => { if (active) setRows(values); }).catch((reason) => { if (active) setError(getApiErrorMessage(reason)); }); return () => { active = false; }; }, [eggId]);
  return <section className="space-y-3 rounded-2xl border border-border-subtle p-5"><h2 className="text-lg font-semibold">{t('eggs.versionHistory')}</h2>{error && <p role="alert">{error}</p>}
    {rows.map((row) => <Link key={row.id} className="flex flex-wrap justify-between gap-3 rounded-xl border border-border-subtle p-3 text-sm" to={`/admin/eggs/${row.id}`}><span className="font-mono text-primary">v{row.version}</span><span>{t(`eggs.status.${row.approvalStatus}`)} · {t(row.isEnabled ? 'eggs.enabled' : 'eggs.disabled')}</span></Link>)}
  </section>;
};

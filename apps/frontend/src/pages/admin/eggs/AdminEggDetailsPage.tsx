import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/app/store/auth.store';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { eggsApi } from '@/features/eggs/api/eggsApi';
import { useAdminEgg } from '@/features/eggs/hooks/useAdminEgg';
import { getApiErrorMessage as roleErrorMessage } from '@/shared/lib/getApiErrorMessage';
import { EggTagAssignmentEditor } from '@/features/eggs/components/EggTagAssignmentEditor';
import { EggVersionHistory } from '@/features/eggs/components/EggVersionHistory';

export const AdminEggDetailsPage = () => {
  const { id } = useParams(); const { t } = useTranslation(); const { egg, loading, error, refresh } = useAdminEgg(id);
  const permissions = useAuthStore((state) => state.user?.permissions); const [busy, setBusy] = useState(false); const [actionError, setError] = useState('');
  const [pending, setPending] = useState<'APPROVED' | 'REJECTED' | 'enable' | 'disable' | null>(null);
  const apply = async () => { if (!id || !pending || busy) return; setBusy(true); setError('');
    try { if (pending === 'APPROVED' || pending === 'REJECTED') await eggsApi.approve(id, pending); else await eggsApi.enable(id, pending === 'enable'); setPending(null); refresh(); }
    catch (reason) { setPending(null); setError(roleErrorMessage(reason)); } finally { setBusy(false); } };
  return <div className="space-y-6"><Link to="/admin/eggs">← {t('eggs.library')}</Link><h1 className="text-3xl font-bold">{egg?.name ?? t('eggs.details')}</h1>
    {(error || actionError) && <p role="alert">{error || actionError}</p>}{loading && <p role="status">{t('common.loading')}</p>}
    {egg && <><p>{egg.version} · {t(`eggs.status.${egg.approvalStatus}`)} · {t(egg.isEnabled ? 'eggs.enabled' : 'eggs.disabled')}</p><p>{egg.description}</p>
      <p>{t('eggs.usedByServices', { count: egg._count?.services ?? 0 })}</p>
      <EggTagAssignmentEditor key={egg.id} eggId={egg.id} canEdit={!!permissions?.includes('egg:manage')} />
      <EggVersionHistory eggId={egg.id} />
      {egg.provenance && <section className="space-y-2 rounded-xl border border-border-subtle p-4 text-sm"><h2 className="font-semibold">{t('eggs.provenance')}</h2>
        <p className="break-all">{egg.provenance.url}</p><p className="break-all font-mono">Commit: {egg.provenance.commit ?? '—'}</p><p className="break-all font-mono">SHA-256: {egg.provenance.sha256}</p>
      </section>}
      {egg.manifest.catalog && <p className="text-amber-300">{t('eggs.contractV2Required')}</p>}
      <div className="flex flex-wrap gap-3">
        {permissions?.includes('egg:manage') && <Link className="rounded-xl border border-border-subtle px-4 py-2" to={`/admin/eggs/${id}/edit`}>{t('eggs.edit')}</Link>}
        {permissions?.includes('egg:approve') && <><button disabled={busy} onClick={() => setPending('APPROVED')}>{t('eggs.approve')}</button><button disabled={busy} onClick={() => setPending('REJECTED')}>{t('eggs.reject')}</button></>}
        {permissions?.includes('egg:manage') && <button disabled={busy || (!egg.isEnabled && egg.approvalStatus !== 'APPROVED')} onClick={() => setPending(egg.isEnabled ? 'disable' : 'enable')}>{t(egg.isEnabled ? 'eggs.disable' : 'eggs.enable')}</button>}
      </div><details className="rounded-2xl border border-border-subtle p-5"><summary>{t('eggs.manifest')}</summary><pre className="mt-4 overflow-x-auto text-xs">{JSON.stringify(egg.manifest, null, 2)}</pre></details>
    </>}
    <ConfirmDialog open={!!pending} title={t('eggs.confirmAction')} description={t('eggs.approvalNote')} confirmLabel={t('common.confirm')} busy={busy} onCancel={() => { if (!busy) setPending(null); }} onConfirm={() => void apply()} />
  </div>;
};

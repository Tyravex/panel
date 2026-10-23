import { useState } from 'react';
import { Plus, RefreshCw, ServerCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/app/store/auth.store';
import { ServiceCreateForm } from '@/features/services/components/ServiceCreateForm';
import { AdminServicesTable } from '@/features/services/components/AdminServicesTable';
import { useAdminServices } from '@/features/services/hooks/useAdminServices';

export const AdminServicesPage = () => {
    const { t } = useTranslation();
    const user = useAuthStore((state) => state.user);
    const canCreate = Boolean(user?.roles?.includes('Owner') && user.permissions.includes('service:create'));
    const canManage = Boolean(user?.roles?.includes('Owner') && user.permissions.includes('service:manage:any'));
    const {
        services, nodes, servicesLoading, nodesLoading, servicesError, nodesError,
        actionError, setActionError, busy, refresh, create, setOwner,
    } = useAdminServices(t('adminServices.unexpectedError'));
    const [notice, setNotice] = useState('');
    const [showCreate, setShowCreate] = useState(false);

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-primary">{t('adminServices.administration')}</p>
                    <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold"><ServerCog aria-hidden="true" /> {t('adminServices.title')}</h1>
                    <p className="mt-2 text-text-secondary">{t('adminServices.description')}</p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={refresh} disabled={servicesLoading || busy} className="flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2 disabled:opacity-50"><RefreshCw size={17} /> {t('adminServices.refresh')}</button>
                    {canCreate && <button type="button" onClick={() => setShowCreate((value) => !value)} disabled={busy} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50"><Plus size={17} /> {t('adminServices.createService')}</button>}
                </div>
            </header>
            {actionError && <p role="alert" className="rounded-xl border border-red-500/30 p-4 text-red-300">{actionError}</p>}
            {servicesError && <p role="alert" className="rounded-xl border border-red-500/30 p-4 text-red-300">{servicesError}</p>}
            {nodesError && <p role="alert" className="rounded-xl border border-amber-500/30 p-4 text-amber-300">{nodesError}</p>}
            {notice && <p role="status" className="rounded-xl border border-emerald-500/30 p-4 text-emerald-300">{notice}</p>}
            {showCreate && canCreate && <ServiceCreateForm nodes={nodes} nodesLoading={nodesLoading} nodesError={nodesError} busy={busy} onCreate={create} onCancel={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setNotice(t('adminServices.createdNotice')); }} />}
            <AdminServicesTable services={services} nodes={nodes} loading={servicesLoading} busy={busy} canManage={canManage} onChangeOwner={setOwner} onChanged={() => { setActionError(''); setNotice(t('adminServices.ownerUpdated')); }} />
            {nodesLoading && <p className="text-xs text-text-secondary">{t('adminServices.nodesLoading')}</p>}
        </div>
    );
};

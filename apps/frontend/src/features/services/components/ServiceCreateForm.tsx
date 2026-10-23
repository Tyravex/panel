import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { NodeRecord } from '@/features/nodes/api/nodesApi';
import type { CreateAdminService } from '@/features/services/api/adminServicesApi';
import { ServiceOwnerPicker } from '@/features/services/components/ServiceOwnerPicker';
import { emptyServiceForm, serviceFieldClass, serviceSelectClass, ServiceValidationError, toCreateServicePayload } from '@/features/services/lib/serviceForm';

interface Props {
    nodes: NodeRecord[];
    nodesLoading: boolean;
    nodesError: string;
    busy: boolean;
    onCreate: (payload: CreateAdminService) => Promise<boolean>;
    onCancel: () => void;
    onCreated: () => void;
}

export const ServiceCreateForm = ({ nodes, nodesLoading, nodesError, busy, onCreate, onCancel, onCreated }: Props) => {
    const { t } = useTranslation();
    const [form, setForm] = useState(emptyServiceForm);
    const [validationError, setValidationError] = useState('');
    const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (busy) return;
        setValidationError('');
        try {
            const payload = toCreateServicePayload(form);
            if (await onCreate(payload)) { setForm(emptyServiceForm()); onCreated(); }
        } catch (error) {
            if (error instanceof ServiceValidationError) setValidationError(t(`adminServices.validation.${error.field}`));
            else setValidationError(t('adminServices.unexpectedError'));
        }
    };
    const categories = ['server', 'discord_bot', 'telegram_bot', 'other'] as const;
    return (
        <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-6">
            <h2 className="text-xl font-semibold">{t('adminServices.createTitle')}</h2>
            <p className="text-sm text-text-secondary">{t('adminServices.draftDescription')}</p>
            {validationError && <p role="alert" className="text-sm text-red-400">{validationError}</p>}
            <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2"><span className="block text-sm">{t('adminServices.name')}</span><input required maxLength={100} value={form.name} onChange={(event) => setField('name', event.target.value)} className={serviceFieldClass} /></label>
                <label className="space-y-2"><span className="block text-sm">{t('adminServices.category')}</span><select value={form.categoryKey} onChange={(event) => setField('categoryKey', event.target.value)} className={serviceSelectClass}>{categories.map((key) => <option key={key} value={key}>{t(`adminServices.categories.${key}`)}</option>)}</select></label>
                <div className="space-y-2"><span className="block text-sm">{t('adminServices.ownerOptional')}</span><ServiceOwnerPicker value={form.ownerId} onChange={(id) => setField('ownerId', id)} disabled={busy} /></div>
                <label className="space-y-2"><span className="block text-sm">{t('adminServices.nodeOptional')}</span><select value={form.nodeId} onChange={(event) => setField('nodeId', event.target.value)} disabled={busy || nodesLoading || Boolean(nodesError)} className={serviceSelectClass}><option value="">{t('adminServices.unassigned')}</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.name} ({node.status})</option>)}</select></label>
                {(['memoryMb', 'cpuPercent', 'diskMb'] as const).map((key) => <label key={key} className="space-y-2"><span className="block text-sm">{t(`adminServices.resources.${key}`)}</span><input type="number" min={1} max={key === 'memoryMb' ? 1048576 : key === 'cpuPercent' ? 100000 : 10485760} step={1} value={form[key]} onChange={(event) => setField(key, event.target.value)} className={serviceFieldClass} /></label>)}
            </div>
            {nodesError && <p role="alert" className="text-sm text-amber-400">{t('adminServices.nodesUnavailable', { message: nodesError })}</p>}
            <div className="flex gap-3"><button type="submit" disabled={busy} className="rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? t('common.saving') : t('adminServices.createDraft')}</button><button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-border-subtle px-5 py-3">{t('common.cancel')}</button></div>
        </form>
    );
};

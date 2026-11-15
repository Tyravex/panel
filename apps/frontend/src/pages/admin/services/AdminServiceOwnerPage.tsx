import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';
import { adminServicesApi, type AdminService } from '@/features/services/api/adminServicesApi';
import { AdminServiceHeader } from '@/features/services/components/AdminServiceHeader';
import { ServiceOwnerPicker } from '@/features/services/components/ServiceOwnerPicker';
import { useAdminService } from '@/features/services/hooks/useAdminService';
import { getServiceErrorMessage } from '@/features/services/lib/serviceForm';

const OwnerForm = ({ service }: { service: AdminService }) => {
  const { t } = useTranslation(); const navigate = useNavigate();
  const [owner, setOwner] = useState(service.userId); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const unsaved = useUnsavedChanges(owner !== service.userId);
  return <form className="space-y-5 rounded-2xl border border-border-subtle p-6" onSubmit={(event) => {
    event.preventDefault(); if (saving || owner === service.userId) return;
    if (!window.confirm(t('adminServices.confirmOwner', { name: service.name }))) return;
    setSaving(true);
    void adminServicesApi.setOwner(service.id, owner).then(() => { unsaved.markSaved(); navigate(`/admin/services/${service.id}`); })
      .catch((reason: unknown) => setError(getServiceErrorMessage(reason, t('adminServices.unexpectedError')))).finally(() => setSaving(false));
  }}>
    {error && <p role="alert">{error}</p>}<ServiceOwnerPicker value={owner} onChange={setOwner} currentOwner={service.user} disabled={saving} />
    <button disabled={saving || owner === service.userId} className="rounded-xl bg-primary px-5 py-3 text-white disabled:opacity-50">{t('common.save')}</button>
  </form>;
};
export const AdminServiceOwnerPage = () => {
  const { id } = useParams(); const { t } = useTranslation(); const { service, loading, error } = useAdminService(id);
  return <div className="space-y-6"><AdminServiceHeader title={t('adminServices.changeOwner')} id={id} />
    {loading && <p role="status">{t('common.loading')}</p>}{error && <p role="alert">{error}</p>}{service && <OwnerForm key={service.id} service={service} />}
  </div>;
};

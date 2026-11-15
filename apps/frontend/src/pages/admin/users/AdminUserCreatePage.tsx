import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuthStore } from '@/app/store/auth.store';
import {
  createAdminUser,
  emptyAdminUserForm,
} from '@/features/admin-users/api/admin-users.api';
import { AdminUserForm } from '@/features/admin-users/components/AdminUserForm';
import { AdminUsersBackLink } from '@/features/admin-users/components/AdminUsersBackLink';
import type { AdminUserFormValues } from '@shared/types';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';

export const AdminUserCreatePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useAuthStore((state) => state.user);
  const canCreate = !!me?.permissions?.includes('user:create');

  const [form, setForm] = useState<AdminUserFormValues>(
    emptyAdminUserForm,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [initialForm] = useState<AdminUserFormValues>(emptyAdminUserForm);
  const unsaved = useUnsavedChanges(canCreate && JSON.stringify(form) !== JSON.stringify(initialForm));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canCreate || busy) return;

    setBusy(true);
    setError(false);

    try {
      await createAdminUser(form);
      unsaved.markSaved();
      toast.success(t('adminUsers.createSuccess'));
      navigate('/admin/users');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <AdminUsersBackLink />
        <h1 className="text-3xl font-bold">
          {t('adminUsers.createUser')}
        </h1>
      </header>

      {error && (
        <p role="alert" className="text-red-400">
          {t('adminUsers.operationError')}
        </p>
      )}

      {canCreate && (
        <AdminUserForm
          creating
          form={form}
          setForm={setForm}
          busy={busy}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/admin/users')}
        />
      )}
    </div>
  );
};

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  emptyAdminUserForm,
  getAdminUser,
  updateAdminUser,
} from '@/features/admin-users/api/admin-users.api';
import { AdminUserForm } from '@/features/admin-users/components/AdminUserForm';
import { AdminUsersBackLink } from '@/features/admin-users/components/AdminUsersBackLink';
import type { AdminUserFormValues } from '@shared/types';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';

export const AdminUserEditPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const userId =
    id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))
      ? Number(id)
      : null;

  const [form, setForm] = useState<AdminUserFormValues>(
    emptyAdminUserForm,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [initialForm, setInitialForm] = useState<AdminUserFormValues>(emptyAdminUserForm);
  const unsaved = useUnsavedChanges(!loading && !loadError && JSON.stringify(form) !== JSON.stringify(initialForm));

  useEffect(() => {
    const controller = new AbortController();

    if (userId === null) {
      setLoadError(true);
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    setLoadError(false);
    setActionError(false);

    getAdminUser(userId, controller.signal)
      .then((user) => {
        if (!controller.signal.aborted) {
          const loaded = {
            username: user.username,
            email: user.email,
            firstName: user.firstName ?? '',
            lastName: user.lastName ?? '',
            password: '',
          };
          setForm(loaded);
          setInitialForm(loaded);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [userId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (userId === null || busy || loading || loadError) return;

    setBusy(true);
    setActionError(false);

    try {
      await updateAdminUser(userId, form);
      unsaved.markSaved();
      toast.success(t('adminUsers.updateSuccess'));
      navigate('/admin/users');
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <AdminUsersBackLink />

        <h1 className="text-3xl font-bold">
          {t('adminUsers.editUser')}
        </h1>
      </header>

      {loading && (
        <p role="status" className="text-text-secondary">
          {t('adminUsers.loading')}
        </p>
      )}

      {!loading && loadError && (
        <p role="alert" className="text-red-400">
          {t('adminUsers.userLoadError')}
        </p>
      )}

      {actionError && (
        <p role="alert" className="text-red-400">
          {t('adminUsers.operationError')}
        </p>
      )}

      {!loading && !loadError && userId !== null && (
        <AdminUserForm
          creating={false}
          form={form}
          setForm={setForm}
          busy={busy}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/admin/users/${userId}`)}
        />
      )}
    </div>
  );
};

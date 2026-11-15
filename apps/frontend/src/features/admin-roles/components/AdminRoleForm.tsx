import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { RolePermission } from '../api/adminRolesApi';
import { PermissionGroups } from './PermissionGroups';

interface AdminRoleFormProps {
  name: string;
  setName: (name: string) => void;
  selected: string[];
  setSelected: Dispatch<SetStateAction<string[]>>;
  permissions: RolePermission[];
  loading: boolean;
  saving: boolean;
  disabled?: boolean;
  creating?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

export const AdminRoleForm = ({
  name, setName, selected, setSelected, permissions, loading, saving,
  disabled = false, creating = false, onSubmit, onCancel,
}: AdminRoleFormProps) => {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <fieldset disabled={disabled || saving || loading} className="space-y-5">
        <label className="block space-y-2 text-sm font-medium">
          <span>{t('adminRoles.roleName')}</span>
          <input required minLength={3} maxLength={50} pattern="[A-Za-z][A-Za-z0-9 _-]{2,49}"
            value={name} onChange={(event) => setName(event.target.value)}
            placeholder={t('adminRoles.roleNamePlaceholder')}
            className="block w-full rounded-xl border border-border-subtle bg-transparent px-4 py-3" />
        </label>
        <fieldset className="space-y-3">
          <legend className="mb-3 font-medium">
            {t('adminRoles.selectedPermissions', { count: selected.length })}
          </legend>
          {loading && <p role="status" className="text-sm text-text-secondary">{t('adminRoles.loadingPermissions')}</p>}
          {!loading && permissions.length === 0 && (
            <p className="text-sm text-text-secondary">{t('adminRoles.noPermissionsAvailable')}</p>
          )}
          <PermissionGroups permissions={permissions} selected={selected} setSelected={setSelected} />
        </fieldset>
        <button type="submit" className="rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50">
          {saving ? t('common.saving') : t(creating ? 'adminRoles.createRole' : 'adminRoles.saveChanges')}
        </button>
      </fieldset>
      <button type="button" onClick={onCancel} disabled={saving}
        className="rounded-xl border border-border-subtle px-5 py-3 disabled:opacity-40">
        {t('common.cancel')}
      </button>
    </form>
  );
};

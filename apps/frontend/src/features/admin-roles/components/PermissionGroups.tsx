import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { RolePermission } from '../api/adminRolesApi';
import { groupRolePermissions, isCatalogPermission, permissionTranslationKey } from '../lib/groupRolePermissions';
import { PermissionInfo } from './PermissionInfo';

interface PermissionGroupsProps {
  permissions: RolePermission[];
  selected: string[];
  setSelected: Dispatch<SetStateAction<string[]>>;
}

export const PermissionGroups = ({ permissions, selected, setSelected }: PermissionGroupsProps) => {
  const { t } = useTranslation();
  return <div className="space-y-5">
    {groupRolePermissions(permissions).map((group) => (
      <fieldset key={group.id} className="rounded-xl border border-border-subtle p-4">
        <legend className="px-2 font-semibold">{t(`adminRoles.permissionGroups.${group.id}`)}</legend>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {group.permissions.map((permission) => {
            const key = permissionTranslationKey(permission.name);
            const label = isCatalogPermission(permission.name)
              ? t(`adminRoles.permissionLabels.${key}`) : permission.name;
            const description = isCatalogPermission(permission.name)
              ? t(`adminRoles.permissionDescriptions.${key}`) : t('adminRoles.unknownPermissionDescription');
            return <div key={permission.id} className="flex items-start gap-2 rounded-xl border border-border-subtle bg-white/[0.02] p-3">
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={selected.includes(permission.id)}
                  onChange={(event) => setSelected((current) => event.target.checked
                    ? [...current, permission.id] : current.filter((id) => id !== permission.id))}
                  className="mt-1 accent-violet-500" />
                <span className="min-w-0">
                  <span className="block font-medium">{label}</span>
                  <span className="mt-1 block break-all font-mono text-xs text-text-secondary">{permission.name}</span>
                </span>
              </label>
              <PermissionInfo label={t('adminRoles.permissionInfo', { permission: label })} description={description} />
            </div>;
          })}
        </div>
      </fieldset>
    ))}
  </div>;
};

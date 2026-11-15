import { useTranslation } from 'react-i18next';
import type { RolePermission } from '../api/adminRolesApi';
import { groupRolePermissions, isCatalogPermission, permissionTranslationKey } from '../lib/groupRolePermissions';
import { PermissionInfo } from './PermissionInfo';

export const RolePermissionDetails = ({ permissions, compact = false }: { permissions: RolePermission[]; compact?: boolean }) => {
  const { t } = useTranslation();
  return <div className="space-y-5">
    {groupRolePermissions(permissions).map((group) => <section key={group.id} className="space-y-3">
      <h3 className="font-semibold">{t(`adminRoles.permissionGroups.${group.id}`)}</h3>
      <ul className={compact ? 'space-y-2' : 'grid gap-3 md:grid-cols-2 xl:grid-cols-3'}>
        {group.permissions.map((permission) => {
          const known = isCatalogPermission(permission.name);
          const key = permissionTranslationKey(permission.name);
          const label = known ? t(`adminRoles.permissionLabels.${key}`) : permission.name;
          const description = known ? t(`adminRoles.permissionDescriptions.${key}`) : t('adminRoles.unknownPermissionDescription');
          return <li key={permission.id} className="flex items-start justify-between gap-2 rounded-xl border border-border-subtle bg-surface p-3">
            <span className="min-w-0 text-sm"><span className="block font-medium">{label}</span>
              {known && <span className="mt-1 block break-all font-mono text-xs text-text-secondary">{permission.name}</span>}
            </span>
            <PermissionInfo label={t('adminRoles.permissionInfo', { permission: label })} description={description} />
          </li>;
        })}
      </ul>
    </section>)}
  </div>;
};

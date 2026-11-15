import { RBAC_V2_PERMISSION_GROUPS, type RbacV2PermissionGroup } from '@shared/types';
import type { RolePermission } from '../api/adminRolesApi';

const groups = Object.entries(RBAC_V2_PERMISSION_GROUPS);
const known = new Set<string>(groups.flatMap(([, names]) => [...names]));

export const permissionTranslationKey = (name: string) => name.replaceAll(':', '_');
export const isCatalogPermission = (name: string) => known.has(name);

/** Group only records returned by the API; never synthesize database permission IDs. */
export function groupRolePermissions(permissions: RolePermission[]): {
  id: RbacV2PermissionGroup | 'other'; permissions: RolePermission[];
}[] {
  const result = groups.map(([id, names]) => ({
    id: id as RbacV2PermissionGroup | 'other',
    permissions: permissions.filter((permission) => (names as readonly string[]).includes(permission.name)),
  }));
  result.push({ id: 'other', permissions: permissions.filter((permission) => !known.has(permission.name)) });
  return result.filter((group) => group.permissions.length > 0);
}

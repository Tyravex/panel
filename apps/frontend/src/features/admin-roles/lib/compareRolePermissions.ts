import type { RoleDefinition, RolePermission } from '../api/adminRolesApi';

/** Keep permissions attached to roles even when the current catalog omits them. */
export const comparisonPermissions = (roles: RoleDefinition[], catalog: RolePermission[]) => {
  const permissions = new Map(catalog.map((permission) => [permission.name, permission]));
  for (const role of roles) {
    for (const permission of role.permissions) {
      if (!permissions.has(permission.name)) permissions.set(permission.name, permission);
    }
  }
  return [...permissions.values()];
};

export const permissionDiffers = (roles: RoleDefinition[], name: string) => {
  if (roles.length < 2) return false;
  const grants = roles.map((role) => role.permissions.some((permission) => permission.name === name));
  return grants.some(Boolean) && !grants.every(Boolean);
};

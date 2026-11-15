import type { RoleDefinition, RoleInput, RolePermission } from '../api/adminRolesApi';

export interface RoleChanges {
  previousName: string;
  nextName: string;
  added: RolePermission[];
  removed: RolePermission[];
  changed: boolean;
}

export const getRoleChanges = (role: RoleDefinition, input: RoleInput, catalog: RolePermission[]): RoleChanges => {
  const original = new Set(role.permissions.map((permission) => permission.id));
  const selected = new Set(input.permissionIds);
  const available = new Map(catalog.map((permission) => [permission.id, permission]));
  const added = [...selected].filter((id) => !original.has(id)).map((id) => available.get(id) ?? { id, name: id });
  const removed = role.permissions.filter((permission) => !selected.has(permission.id));
  const nextName = input.name.trim();
  return {
    previousName: role.name, nextName, added, removed,
    changed: role.name !== nextName || added.length > 0 || removed.length > 0
  };
};

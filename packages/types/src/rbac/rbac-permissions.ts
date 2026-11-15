/**
 * Global RBAC v2 permission catalog.
 *
 * These permissions apply to panel-wide authorization.
 * Service member permissions are defined separately.
 */
export const RBAC_V2_PERMISSION_GROUPS = {
  services: [
    'service:read:any',
    'service:create',
    'service:manage:any',
    'service:suspend',
    'service:unsuspend',
    'service:delete:any',
    'service:transfer:any',
    'service:install:any',
  ],
  eggs: [
    'egg:read', 'egg:import', 'egg:manage', 'egg:approve',
    'egg-repository:manage', 'egg-repository:sync',
  ],
  infrastructure: [
    'node:read',
    'node:manage',
    'node:delete',
    'location:manage',
    'region:manage',
  ],
  users: [
    'user:read',
    'user:create',
    'user:manage',
    'user:suspend',
    'user:delete',
  ],
  roles: [
    'role:read',
    'role:manage',
    'role:assign',
  ],
  billing: [
    'billing:read',
    'billing:manage',
    'billing:refund',
  ],
  plugins: [
    'plugin:read',
    'plugin:manage',
    'plugin:delete',
    'marketplace:manage',
  ],
  system: [
    'audit:read',
    'settings:read',
    'settings:manage',
    'backup:manage',
    'job:manage',
  ],
} as const;

export const RBAC_V2_PERMISSIONS = [
  ...RBAC_V2_PERMISSION_GROUPS.services,
  ...RBAC_V2_PERMISSION_GROUPS.eggs,
  ...RBAC_V2_PERMISSION_GROUPS.infrastructure,
  ...RBAC_V2_PERMISSION_GROUPS.users,
  ...RBAC_V2_PERMISSION_GROUPS.roles,
  ...RBAC_V2_PERMISSION_GROUPS.billing,
  ...RBAC_V2_PERMISSION_GROUPS.plugins,
  ...RBAC_V2_PERMISSION_GROUPS.system,
] as const;

export type RbacV2Permission =
  (typeof RBAC_V2_PERMISSIONS)[number];

export type RbacV2PermissionGroup =
  keyof typeof RBAC_V2_PERMISSION_GROUPS;

export const isRbacV2Permission = (
  value: string,
): value is RbacV2Permission =>
  (RBAC_V2_PERMISSIONS as readonly string[]).includes(value);

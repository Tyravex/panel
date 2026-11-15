import {
  RBAC_V2_PERMISSIONS,
  type RbacV2Permission,
} from './rbac-v2.catalog';

/**
 * Default role templates.
 *
 * Templates must be initialized only once per installation.
 * Do not blindly upsert them on every seed execution.
 *
 * Owner is the only system-managed role.
 */
export const RBAC_V2_DEFAULT_ROLES = {
  Owner: {
    system: true,
    permissions: RBAC_V2_PERMISSIONS,
  },

  Administrator: {
    system: false,
    permissions: [
      'service:read:any',
      'service:create',
      'service:install:any',
      'egg:read', 'egg:import', 'egg:manage', 'egg:approve', 'egg-repository:manage', 'egg-repository:sync',
      'service:manage:any',
      'service:suspend',
      'service:unsuspend',
      'service:transfer:any',

      'node:read',
      'node:manage',
      'location:manage',
      'region:manage',

      'user:read',
      'user:create',
      'user:manage',
      'user:suspend',

      'role:read',
      'role:manage',
      'role:assign',

      'billing:read',
      'billing:manage',

      'plugin:read',
      'plugin:manage',
      'marketplace:manage',

      'audit:read',
      'settings:read',
      'settings:manage',
      'backup:manage',
      'job:manage',
    ] satisfies readonly RbacV2Permission[],
  },

  Moderator: {
    system: false,
    permissions: [
      'service:read:any',
      'service:manage:any',
      'service:suspend',
      'service:unsuspend',
      'node:read',
      'user:read',
      'user:manage',
      'user:suspend',
      'role:read',
    ] satisfies readonly RbacV2Permission[],
  },

  Support: {
    system: false,
    permissions: [
      'service:read:any',
      'node:read',
      'user:read',
      'role:read',
      'plugin:read',
    ] satisfies readonly RbacV2Permission[],
  },

  'Billing Manager': {
    system: false,
    permissions: [
      'billing:read',
      'billing:manage',
      'user:read',
    ] satisfies readonly RbacV2Permission[],
  },

  User: {
    system: false,
    permissions: [] as readonly RbacV2Permission[],
  },
} as const;

export type RbacV2DefaultRoleName =
  keyof typeof RBAC_V2_DEFAULT_ROLES;

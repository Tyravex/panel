/**
 * Backend compatibility exports for RBAC v2.
 *
 * The active permission catalog is maintained in @shared/types.
 * Legacy server permissions remain backend-only during migration.
 */
export {
  RBAC_V2_PERMISSION_GROUPS,
  RBAC_V2_PERMISSIONS,
  isRbacV2Permission,
} from '@shared/types';

export type {
  RbacV2Permission,
  RbacV2PermissionGroup,
} from '@shared/types';

export const RBAC_V2_LEGACY_SERVER_PERMISSIONS = [
  'server:create',
  'server:manage:any',
  'server:suspend',
  'server:unsuspend',
] as const;

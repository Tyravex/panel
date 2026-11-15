import {
  RBAC_V2_LEGACY_SERVER_PERMISSIONS,
  RBAC_V2_PERMISSION_GROUPS,
  RBAC_V2_PERMISSIONS,
  isRbacV2Permission,
} from '../rbac-v2.catalog';

import { RBAC_V2_DEFAULT_ROLES } from '../rbac-v2.default-roles';

describe('RBAC v2 catalog', () => {
  it('contains exactly 39 unique active permissions', () => {
    expect(RBAC_V2_PERMISSIONS).toHaveLength(39);
    expect(new Set(RBAC_V2_PERMISSIONS).size).toBe(39);
  });

  it('contains exactly eight permission groups', () => {
    expect(Object.keys(RBAC_V2_PERMISSION_GROUPS)).toHaveLength(8);

    const flattened = Object.values(RBAC_V2_PERMISSION_GROUPS).flat();

    expect(flattened).toEqual([...RBAC_V2_PERMISSIONS]);
  });

  it('keeps four legacy server permissions separate', () => {
    expect(RBAC_V2_LEGACY_SERVER_PERMISSIONS).toHaveLength(4);

    for (const permission of RBAC_V2_LEGACY_SERVER_PERMISSIONS) {
      expect(RBAC_V2_PERMISSIONS).not.toContain(permission);
      expect(isRbacV2Permission(permission)).toBe(false);
    }
  });

  it('recognizes active permissions only', () => {
    expect(isRbacV2Permission('role:assign')).toBe(true);
    expect(isRbacV2Permission('service:transfer:any')).toBe(true);
    expect(isRbacV2Permission('server:create')).toBe(false);
    expect(isRbacV2Permission('unknown:permission')).toBe(false);
  });
});

describe('RBAC v2 default roles', () => {
  it('defines exactly six default roles', () => {
    expect(Object.keys(RBAC_V2_DEFAULT_ROLES)).toEqual([
      'Owner',
      'Administrator',
      'Moderator',
      'Support',
      'Billing Manager',
      'User',
    ]);
  });

  it('makes Owner the only system-managed role', () => {
    for (const [name, role] of Object.entries(RBAC_V2_DEFAULT_ROLES)) {
      expect(role.system).toBe(name === 'Owner');
    }
  });

  it('grants Owner all 39 active permissions', () => {
    expect(RBAC_V2_DEFAULT_ROLES.Owner.permissions).toEqual(
      RBAC_V2_PERMISSIONS,
    );
  });

  it.each([
    ['Administrator', 34],
    ['Moderator', 9],
    ['Support', 5],
    ['Billing Manager', 3],
    ['User', 0],
  ] as const)('%s has %i default permissions', (name, count) => {
    expect(RBAC_V2_DEFAULT_ROLES[name].permissions).toHaveLength(count);
  });

  it('does not contain unknown or duplicate role permissions', () => {
    const validPermissions = new Set<string>(RBAC_V2_PERMISSIONS);

    for (const role of Object.values(RBAC_V2_DEFAULT_ROLES)) {
      expect(new Set(role.permissions).size).toBe(role.permissions.length);

      for (const permission of role.permissions) {
        expect(validPermissions.has(permission)).toBe(true);
      }
    }
  });

  it('does not grant destructive permissions to Administrator', () => {
    const permissions = RBAC_V2_DEFAULT_ROLES.Administrator.permissions;

    expect(permissions).not.toContain('service:delete:any');
    expect(permissions).not.toContain('node:delete');
    expect(permissions).not.toContain('user:delete');
    expect(permissions).not.toContain('plugin:delete');
    expect(permissions).not.toContain('billing:refund');
  });

  it('keeps Support read-only', () => {
    for (const permission of RBAC_V2_DEFAULT_ROLES.Support.permissions) {
      expect(permission).toMatch(/:read(?::any)?$/);
    }
  });

  it('does not grant global admin permissions to User', () => {
    expect(RBAC_V2_DEFAULT_ROLES.User.permissions).toEqual([]);
  });
});

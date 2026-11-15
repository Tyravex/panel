import { describe, expect, it } from 'vitest';
import { hasAdminAccess } from './permissions';
import type { User } from '@/entities/User';

const userWith = (...permissions: string[]): User =>
  ({
    id: 42,
    permissions,
  }) as User;

describe('RBAC v2 administration entry access', () => {
  it.each(['service:read:any', 'egg:read'])('allows %s without an Owner role', (permission) => {
    expect(hasAdminAccess(userWith(permission))).toBe(true);
  });
  it.each(['location:manage', 'node:read', 'plugin:read'])(
    'allows %s without legacy management permissions',
    (permission) => {
      expect(hasAdminAccess(userWith(permission))).toBe(true);
    },
  );
  it('allows region:manage without node:manage', () => {
    expect(hasAdminAccess(userWith('region:manage'))).toBe(true);
  });

  it('allows user:create without user:manage', () => {
    expect(hasAdminAccess(userWith('user:create'))).toBe(true);
  });

  it('allows role:read without role:manage', () => {
    expect(hasAdminAccess(userWith('role:read'))).toBe(true);
  });

  it('allows role:assign without role:manage', () => {
    expect(hasAdminAccess(userWith('role:assign'))).toBe(true);
  });

  it('allows audit:read without role:manage', () => {
    expect(hasAdminAccess(userWith('audit:read'))).toBe(true);
  });

  it('allows settings:read without user:manage', () => {
    expect(hasAdminAccess(userWith('settings:read'))).toBe(true);
  });

  it('preserves existing user:read access', () => {
    expect(hasAdminAccess(userWith('user:read'))).toBe(true);
  });

  it('rejects a user without administration permissions', () => {
    expect(hasAdminAccess(userWith('console:read'))).toBe(false);
  });

  it('rejects a missing user', () => {
    expect(hasAdminAccess(null)).toBe(false);
  });
});

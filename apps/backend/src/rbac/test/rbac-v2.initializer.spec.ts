import type { PrismaClient } from '@prisma/client';

import {
  initializeRbacV2,
  RBAC_V2_INITIALIZATION_KEY,
} from '../rbac-v2.initializer';

import {
  RBAC_V2_LEGACY_SERVER_PERMISSIONS,
  RBAC_V2_PERMISSIONS,
} from '../rbac-v2.catalog';

type RoleRecord = {
  id: string;
  permissions: Set<string>;
};

type DatabaseState = {
  permissions: Set<string>;
  roles: Map<string, RoleRecord>;
  settings: Map<string, boolean>;
  defaultRoleId: string | null;
};

function cloneState(state: DatabaseState): DatabaseState {
  return {
    permissions: new Set(state.permissions),
    roles: new Map(
      [...state.roles].map(([name, role]) => [
        name,
        { id: role.id, permissions: new Set(role.permissions) },
      ]),
    ),
    settings: new Map(state.settings),
    defaultRoleId: state.defaultRoleId,
  };
}

function createDatabaseMock() {
  let state: DatabaseState = {
    permissions: new Set(),
    roles: new Map(),
    settings: new Map(),
    defaultRoleId: null,
  };

  let failRoleCreation: string | null = null;
  let transactionCount = 0;
  let lockCount = 0;

  const prisma = {
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      transactionCount += 1;
      const working = cloneState(state);

      const tx = {
        $queryRaw: jest.fn(async () => {
          lockCount += 1;
          return [{ pg_advisory_xact_lock: null }];
        }),

        permission: {
          upsert: jest.fn(async ({ where }: { where: { name: string } }) => {
            working.permissions.add(where.name);
            return { name: where.name };
          }),
        },

        role: {
          findUnique: jest.fn(
            async ({ where }: { where: { name: string } }) => {
              const role = working.roles.get(where.name);
              return role
                ? {
                  id: role.id,
                  permissions: [...role.permissions].slice(0, 1).map((id) => ({ id })),
                }
                : null;
            },
          ),

          upsert: jest.fn(
            async ({
              where,
              update,
              create,
            }: {
              where: { name: string };
              update: {
                permissions: { connect: { name: string }[] };
              };
              create: {
                name: string;
                permissions: { connect: { name: string }[] };
              };
            }) => {
              const existing = working.roles.get(where.name);
              const connected = existing
                ? update.permissions.connect
                : create.permissions.connect;

              for (const permission of connected) {
                if (!working.permissions.has(permission.name)) {
                  throw new Error(`Unknown permission: ${permission.name}`);
                }
              }

              const role = existing ?? {
                id: `role-${where.name}`,
                permissions: new Set<string>(),
              };

              for (const permission of connected) {
                role.permissions.add(permission.name);
              }

              working.roles.set(where.name, role);
              return { id: role.id };
            },
          ),

          create: jest.fn(
            async ({
              data,
            }: {
              data: {
                name: string;
                permissions: { connect: { name: string }[] };
              };
            }) => {
              if (data.name === failRoleCreation) {
                throw new Error(`Simulated failure: ${data.name}`);
              }

              if (working.roles.has(data.name)) {
                throw new Error(`Duplicate role: ${data.name}`);
              }

              for (const permission of data.permissions.connect) {
                if (!working.permissions.has(permission.name)) {
                  throw new Error(`Unknown permission: ${permission.name}`);
                }
              }

              working.roles.set(data.name, {
                id: `role-${data.name}`,
                permissions: new Set(
                  data.permissions.connect.map((permission) => permission.name),
                ),
              });

              return { id: `role-${data.name}` };
            },
          ),
        },

        rbacSettings: {
          findUnique: jest.fn(async () => {
            return working.defaultRoleId === null
              ? null
              : { defaultRoleId: working.defaultRoleId };
          }),
          create: jest.fn(async ({
            data,
          }: {
            data: { id: number; defaultRoleId: string };
          }) => {
            if (data.id !== 1) {
              throw new Error('Invalid RBAC settings ID');
            }
            if (working.defaultRoleId !== null) {
              throw new Error('RBAC settings already exist');
            }
            working.defaultRoleId = data.defaultRoleId;
            return data;
          }),
        },
        panelSetting: {
          findUnique: jest.fn(
            async ({ where }: { where: { key: string } }) => {
              const value = working.settings.get(where.key);
              return value === undefined ? null : { booleanValue: value };
            },
          ),

          upsert: jest.fn(
            async ({
              where,
              create,
              update,
            }: {
              where: { key: string };
              create: { booleanValue: boolean };
              update: { booleanValue: boolean };
            }) => {
              const existing = working.settings.get(where.key);

              working.settings.set(
                where.key,
                existing === undefined
                  ? create.booleanValue
                  : update.booleanValue,
              );

              return { key: where.key };
            },
          ),
        },
      };

      const result = await callback(tx);
      state = working;
      return result;
    }),
  };

  return {
    prisma: prisma as unknown as PrismaClient,
    getState: () => state,
    deleteRole: (name: string) => state.roles.delete(name),
    setDefaultRoleId: (roleId: string | null) => {
      state.defaultRoleId = roleId;
    },
    setRole: (name: string, permissions: string[]) => {
      state.roles.set(name, {
        id: `existing-${name}`,
        permissions: new Set(permissions),
      });
    },
    setFailure: (name: string | null) => {
      failRoleCreation = name;
    },
    getTransactionCount: () => transactionCount,
    getLockCount: () => lockCount,
  };
}

describe('RBAC v2 initializer', () => {
  it('creates Owner, five editable roles and the persistent marker', async () => {
    const db = createDatabaseMock();

    const result = await initializeRbacV2(db.prisma);
    const state = db.getState();

    expect(result.initialized).toBe(true);
    expect(result.createdRoles).toEqual([
      'Administrator',
      'Moderator',
      'Support',
      'Billing Manager',
      'User',
    ]);

    expect(state.roles.size).toBe(6);
    expect(state.permissions.size).toBe(43);
    expect(state.settings.get(RBAC_V2_INITIALIZATION_KEY)).toBe(true);
    expect(db.getTransactionCount()).toBe(1);
    expect(db.getLockCount()).toBe(2);
  });

  it('gives Owner all active and legacy permissions', async () => {
    const db = createDatabaseMock();

    await initializeRbacV2(db.prisma);

    const owner = db.getState().roles.get('Owner');

    expect(owner).toBeDefined();

    for (const permission of [
      ...RBAC_V2_PERMISSIONS,
      ...RBAC_V2_LEGACY_SERVER_PERMISSIONS,
    ]) {
      expect(owner?.permissions.has(permission)).toBe(true);
    }
  });

  it('does not recreate a deleted editable role on the next run', async () => {
    const db = createDatabaseMock();

    await initializeRbacV2(db.prisma);
    db.deleteRole('Support');

    const result = await initializeRbacV2(db.prisma);

    expect(result.initialized).toBe(false);
    expect(result.createdRoles).toEqual([]);
    expect(db.getState().roles.has('Support')).toBe(false);
  });

  it('does not overwrite an existing editable role', async () => {
    const db = createDatabaseMock();

    db.setRole('Administrator', ['user:read']);

    const result = await initializeRbacV2(db.prisma);

    expect(result.existingRoles).toContain('Administrator');

    expect(
      [...(db.getState().roles.get('Administrator')?.permissions ?? [])],
    ).toEqual(['user:read']);
  });

  it('does not overwrite an edited role on subsequent runs', async () => {
    const db = createDatabaseMock();

    await initializeRbacV2(db.prisma);
    db.setRole('Moderator', ['node:read']);

    await initializeRbacV2(db.prisma);

    expect(
      [...(db.getState().roles.get('Moderator')?.permissions ?? [])],
    ).toEqual(['node:read']);
  });

  it('synchronizes Owner even after the initialization marker exists', async () => {
    const db = createDatabaseMock();

    await initializeRbacV2(db.prisma);
    db.setRole('Owner', ['role:read']);

    const result = await initializeRbacV2(db.prisma);

    expect(result.initialized).toBe(false);

    const owner = db.getState().roles.get('Owner');

    expect(owner?.permissions.has('service:delete:any')).toBe(true);
    expect(owner?.permissions.has('server:create')).toBe(true);
  });

  it('rolls back role creation and marker when initialization fails', async () => {
    const db = createDatabaseMock();

    db.setFailure('Moderator');

    await expect(initializeRbacV2(db.prisma)).rejects.toThrow(
      'Simulated failure: Moderator',
    );

    const state = db.getState();

    expect(state.roles.size).toBe(0);
    expect(state.permissions.size).toBe(0);
    expect(state.settings.has(RBAC_V2_INITIALIZATION_KEY)).toBe(false);
  });

  it('can retry successfully after a rolled-back initialization', async () => {
    const db = createDatabaseMock();

    db.setFailure('Moderator');

    await expect(initializeRbacV2(db.prisma)).rejects.toThrow();

    db.setFailure(null);

    const result = await initializeRbacV2(db.prisma);

    expect(result.initialized).toBe(true);
    expect(db.getState().roles.size).toBe(6);
    expect(db.getState().settings.get(RBAC_V2_INITIALIZATION_KEY)).toBe(true);
  });
  it('sets User as the initial default role', async () => {
    const db = createDatabaseMock();

    await initializeRbacV2(db.prisma);

    expect(db.getState().defaultRoleId).toBe('role-User');
  });

  it('preserves an administrator-selected default role', async () => {
    const db = createDatabaseMock();

    await initializeRbacV2(db.prisma);
    db.setRole('Custom Default', []);
    db.setDefaultRoleId('existing-Custom Default');

    await initializeRbacV2(db.prisma);

    expect(db.getState().defaultRoleId).toBe('existing-Custom Default');
  });

  it('does not recreate a deleted User role', async () => {
    const db = createDatabaseMock();

    await initializeRbacV2(db.prisma);
    db.deleteRole('User');
    db.setDefaultRoleId(null);

    await initializeRbacV2(db.prisma);

    expect(db.getState().roles.has('User')).toBe(false);
    expect(db.getState().defaultRoleId).toBeNull();
  });

  it('does not select a privileged User role', async () => {
    const db = createDatabaseMock();

    await initializeRbacV2(db.prisma);
    db.setDefaultRoleId(null);
    db.setRole('User', ['user:manage']);

    await initializeRbacV2(db.prisma);

    expect(db.getState().defaultRoleId).toBeNull();
  });

  it('does not replace a missing User role with another role', async () => {
    const db = createDatabaseMock();

    await initializeRbacV2(db.prisma);
    db.deleteRole('User');
    db.setDefaultRoleId(null);

    await initializeRbacV2(db.prisma);

    expect(db.getState().defaultRoleId).toBeNull();
    expect(db.getState().roles.has('Administrator')).toBe(true);
  });

  it('rolls back default settings when initialization fails', async () => {
    const db = createDatabaseMock();

    db.setFailure('Moderator');

    await expect(initializeRbacV2(db.prisma)).rejects.toThrow();

    expect(db.getState().defaultRoleId).toBeNull();
    expect(db.getState().roles.size).toBe(0);
  });
});

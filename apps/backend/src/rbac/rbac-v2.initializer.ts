import type { PrismaClient } from '@prisma/client';
import { DEFAULT_RBAC_SETTINGS_ID } from './default-role.service';

import {
  RBAC_V2_LEGACY_SERVER_PERMISSIONS,
  RBAC_V2_PERMISSIONS,
} from './rbac-v2.catalog';

import { RBAC_V2_DEFAULT_ROLES } from './rbac-v2.default-roles';

export const RBAC_V2_INITIALIZATION_KEY =
  'rbac:default_roles_initialized:v2';

export interface RbacV2InitializationResult {
  initialized: boolean;
  createdRoles: string[];
  existingRoles: string[];
}

/**
 * Synchronize the permission catalog and initialize default roles.
 *
 * All operations share one PostgreSQL transaction and advisory lock.
 *
 * Owner is system-managed and receives all current permissions.
 * Editable default roles are created only once per installation.
 * Existing editable roles are never overwritten.
 * Deleted editable roles are never recreated after initialization.
 * User-role assignments are not modified.
 */
type RbacTransaction = Parameters<
  Parameters<PrismaClient['$transaction']>[0]
>[0];

async function initializeDefaultRoleSettings(
  tx: RbacTransaction,
): Promise<void> {
  const existing = await tx.rbacSettings.findUnique({
    where: { id: DEFAULT_RBAC_SETTINGS_ID },
    select: { defaultRoleId: true },
  });

  // Administrator-selected configuration is never overwritten.
  if (existing) {
    return;
  }

  const userRole = await tx.role.findUnique({
    where: { name: 'User' },
    select: {
      id: true,
      permissions: {
        select: { id: true },
        take: 1,
      },
    },
  });

  // Do not recreate a deleted User role or select a privileged role.
  if (!userRole || userRole.permissions.length !== 0) {
    return;
  }

  await tx.rbacSettings.create({
    data: {
      id: DEFAULT_RBAC_SETTINGS_ID,
      defaultRoleId: userRole.id,
    },
  });
}
export async function initializeRbacV2(
  prisma: PrismaClient,
): Promise<RbacV2InitializationResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(847201, 1)::text
    `;
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(847201, 2)::text
    `;

    const permissionNames = [
      ...RBAC_V2_PERMISSIONS,
      ...RBAC_V2_LEGACY_SERVER_PERMISSIONS,
    ];

    for (const name of permissionNames) {
      await tx.permission.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }

    await tx.role.upsert({
      where: { name: 'Owner' },
      update: {
        permissions: {
          connect: permissionNames.map((name) => ({ name })),
        },
      },
      create: {
        name: 'Owner',
        permissions: {
          connect: permissionNames.map((name) => ({ name })),
        },
      },
    });

    const marker = await tx.panelSetting.findUnique({
      where: { key: RBAC_V2_INITIALIZATION_KEY },
      select: { booleanValue: true },
    });

    const alreadyInitialized = marker?.booleanValue === true;

    if (alreadyInitialized) {
      await initializeDefaultRoleSettings(tx);
      return {
        initialized: false,
        createdRoles: [],
        existingRoles: [],
      };
    }

    const createdRoles: string[] = [];
    const existingRoles: string[] = [];

    for (const [name, definition] of Object.entries(
      RBAC_V2_DEFAULT_ROLES,
    )) {
      if (name === 'Owner') {
        continue;
      }

      const existing = await tx.role.findUnique({
        where: { name },
        select: { id: true },
      });

      if (existing) {
        existingRoles.push(name);
        continue;
      }

      await tx.role.create({
        data: {
          name,
          permissions: {
            connect: definition.permissions.map(
              (permissionName) => ({ name: permissionName }),
            ),
          },
        },
      });

      createdRoles.push(name);
    }

    await initializeDefaultRoleSettings(tx);

    await tx.panelSetting.upsert({
      where: { key: RBAC_V2_INITIALIZATION_KEY },
      update: { booleanValue: true },
      create: {
        key: RBAC_V2_INITIALIZATION_KEY,
        booleanValue: true,
      },
    });

    return {
      initialized: true,
      createdRoles,
      existingRoles,
    };
  }, { timeout: 60_000 });
}

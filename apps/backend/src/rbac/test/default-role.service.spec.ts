import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DefaultRoleService } from '../default-role.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('DefaultRoleService', () => {
  const role = {
    id: 'role-user',
    name: 'User',
    permissions: [] as Array<{ id: string }>,
  };

  let service: DefaultRoleService;

  let tx: {
    $queryRaw: jest.Mock;
    role: { findUnique: jest.Mock };
    rbacSettings: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    adminAuditLog: { create: jest.Mock };
  };

  let prisma: {
    $transaction: jest.Mock;
    rbacSettings: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      role: {
        findUnique: jest.fn().mockResolvedValue({ ...role }),
      },
      rbacSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      adminAuditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma = {
      $transaction: jest.fn(async (callback) => callback(tx)),
      rbacSettings: {
        findUnique: jest.fn().mockResolvedValue({
          defaultRole: {
            id: role.id,
            name: role.name,
          },
        }),
      },
    };

    service = new DefaultRoleService(
      prisma as unknown as PrismaService,
    );
  });

  it('returns the configured default role', async () => {
    await expect(service.getDefaultRole()).resolves.toEqual({
      id: 'role-user',
      name: 'User',
    });

    expect(prisma.rbacSettings.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: {
        defaultRole: {
          select: { id: true, name: true },
        },
      },
    });
  });

  it('fails closed when the default role is not configured', async () => {
    prisma.rbacSettings.findUnique.mockResolvedValue(null);

    await expect(service.getDefaultRole()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects an invalid role ID', async () => {
    await expect(service.setDefaultRole('', 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an invalid administrator ID', async () => {
    await expect(
      service.setDefaultRole('role-user', 0),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a missing role', async () => {
    tx.role.findUnique.mockResolvedValue(null);

    await expect(
      service.setDefaultRole('missing', 1),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.rbacSettings.upsert).not.toHaveBeenCalled();
  });

  it('rejects Owner as the default role', async () => {
    tx.role.findUnique.mockResolvedValue({
      id: 'owner',
      name: 'Owner',
      permissions: [],
    });

    await expect(
      service.setDefaultRole('owner', 1),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.rbacSettings.upsert).not.toHaveBeenCalled();
  });

  it('rejects roles with any global permission', async () => {
    tx.role.findUnique.mockResolvedValue({
      ...role,
      permissions: [{ id: 'permission-1' }],
    });

    await expect(
      service.setDefaultRole('role-user', 1),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.rbacSettings.upsert).not.toHaveBeenCalled();
  });

  it('updates the default role and creates an audit entry', async () => {
    tx.rbacSettings.findUnique.mockResolvedValue({
      defaultRoleId: 'old-role',
    });

    await expect(
      service.setDefaultRole('role-user', 7),
    ).resolves.toEqual({
      id: 'role-user',
      name: 'User',
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);

    expect(tx.rbacSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { id: 1, defaultRoleId: 'role-user' },
      update: { defaultRoleId: 'role-user' },
    });

    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 7,
        action: 'DEFAULT_ROLE_CHANGED',
        targetType: 'PANEL_SETTING',
        targetId: 'rbac:defaultRoleId',
        metadata: {
          previousRoleId: 'old-role',
          defaultRoleId: 'role-user',
        },
      },
    });
  });

  it('does not rewrite or audit an unchanged default role', async () => {
    tx.rbacSettings.findUnique.mockResolvedValue({
      defaultRoleId: 'role-user',
    });

    await expect(
      service.setDefaultRole('role-user', 7),
    ).resolves.toEqual({
      id: 'role-user',
      name: 'User',
    });

    expect(tx.rbacSettings.upsert).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });
});
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RbacService } from './rbac.service';

describe('RbacService role creation', () => {
  const permissionFindMany = jest.fn();
  const roleCreate = jest.fn();
  const auditCreate = jest.fn();

  const tx = {
    permission: { findMany: permissionFindMany },
    role: { create: roleCreate },
    adminAuditLog: { create: auditCreate },
  };

  const transaction = jest.fn();

  const service = new RbacService({
    // listPermissions() reads directly from PrismaService.
    permission: { findMany: permissionFindMany },

    // createRole() uses the transaction client.
    $transaction: transaction,
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();

    // Restore transaction execution after resetAllMocks().
    transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    auditCreate.mockResolvedValue({ id: 'audit-1' });
  });

  it('lists registered permissions', async () => {
    permissionFindMany.mockResolvedValue([
      { id: 'p1', name: 'user:read' },
    ]);

    await expect(service.listPermissions()).resolves.toHaveLength(1);
  });

  it('creates a role with existing permissions', async () => {
    permissionFindMany.mockResolvedValue([{ id: 'p1' }]);

    roleCreate.mockResolvedValue({
      id: 'r1',
      name: 'Support',
      permissions: [],
    });

    await expect(
      service.createRole({
        name: ' Support ',
        permissionIds: ['p1'],
      }, 7),
    ).resolves.toMatchObject({ id: 'r1' });

    expect(roleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Support',
          permissions: {
            connect: [{ id: 'p1' }],
          },
        },
      }),
    );

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 7,
        action: 'ROLE_CREATED',
        targetType: 'ROLE',
        targetId: 'r1',
      }),
    });

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown permissions', async () => {
    permissionFindMany.mockResolvedValue([]);

    await expect(
      service.createRole({
        name: 'Support',
        permissionIds: ['missing'],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(roleCreate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('rejects duplicate permission IDs', async () => {
    await expect(
      service.createRole({
        name: 'Support',
        permissionIds: ['p1', 'p1'],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects reserved Owner name', async () => {
    await expect(
      service.createRole({
        name: 'owner',
        permissionIds: [],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it('reports duplicate role names', async () => {
    permissionFindMany.mockResolvedValue([]);

    roleCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Duplicate role',
        {
          code: 'P2002',
          clientVersion: 'test',
        },
      ),
    );

    await expect(
      service.createRole({
        name: 'Support',
        permissionIds: [],
      }),
    ).rejects.toThrow(ConflictException);

    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('propagates audit write failures', async () => {
    permissionFindMany.mockResolvedValue([]);

    roleCreate.mockResolvedValue({
      id: 'r2',
      name: 'Support',
      permissions: [],
    });

    auditCreate.mockRejectedValue(
      new Error('Audit write failed'),
    );

    await expect(
      service.createRole({
        name: 'Support',
        permissionIds: [],
      }, 7),
    ).rejects.toThrow('Audit write failed');

    expect(roleCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });
});
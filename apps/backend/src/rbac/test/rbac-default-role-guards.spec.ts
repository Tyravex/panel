import { ConflictException } from '@nestjs/common';
import { RbacService } from '../rbac.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('RbacService default role protection', () => {
  let service: RbacService;

  let tx: {
    $queryRaw: jest.Mock;
    role: {
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    permission: { findMany: jest.Mock };
    rbacSettings: { findUnique: jest.Mock };
    userRole: { count: jest.Mock };
  };

  let prisma: {
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      role: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'role-user',
          name: 'User',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'role-user',
          name: 'User',
          permissions: [],
        }),
        delete: jest.fn().mockResolvedValue({
          id: 'role-user',
        }),
      },
      permission: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'permission-1' },
        ]),
      },
      rbacSettings: {
        findUnique: jest.fn().mockResolvedValue({
          defaultRoleId: 'role-user',
        }),
      },
      userRole: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    prisma = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    service = new RbacService(
      prisma as unknown as PrismaService,
    );
  });

  it('rejects granting permissions to the default role', async () => {
    await expect(
      service.updateRole('role-user', {
        name: 'User',
        permissionIds: ['permission-1'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.role.update).not.toHaveBeenCalled();
  });

  it('allows updating the default role without global permissions', async () => {
    tx.permission.findMany.mockResolvedValue([]);

    await service.updateRole('role-user', {
      name: 'User',
      permissionIds: [],
    });

    expect(tx.role.update).toHaveBeenCalled();
  });

  it('rejects deleting the default role', async () => {
    await expect(
      service.deleteRole('role-user'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.role.delete).not.toHaveBeenCalled();
  });

  it('allows updating a different role', async () => {
    tx.rbacSettings.findUnique.mockResolvedValue({
      defaultRoleId: 'another-role',
    });

    await service.updateRole('role-user', {
      name: 'User',
      permissionIds: ['permission-1'],
    });

    expect(tx.role.update).toHaveBeenCalled();
  });

  it('allows deleting an unassigned non-default role', async () => {
    tx.rbacSettings.findUnique.mockResolvedValue({
      defaultRoleId: 'another-role',
    });

    await service.deleteRole('role-user');

    expect(tx.role.delete).toHaveBeenCalledWith({
      where: { id: 'role-user' },
    });
  });
});
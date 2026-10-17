import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RbacService } from './rbac.service';

describe('RbacService role creation', () => {
  const permissionFindMany = jest.fn();
  const roleCreate = jest.fn();
  const service = new RbacService({
    permission: { findMany: permissionFindMany },
    role: { create: roleCreate },
  } as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('lists registered permissions', async () => {
    permissionFindMany.mockResolvedValue([{ id: 'p1', name: 'user:read' }]);
    await expect(service.listPermissions()).resolves.toHaveLength(1);
  });

  it('creates a role with existing permissions', async () => {
    permissionFindMany.mockResolvedValue([{ id: 'p1' }]);
    roleCreate.mockResolvedValue({ id: 'r1', name: 'Support', permissions: [] });
    await expect(service.createRole({ name: ' Support ', permissionIds: ['p1'] })).resolves.toMatchObject({ id: 'r1' });
    expect(roleCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: 'Support', permissions: { connect: [{ id: 'p1' }] } },
    }));
  });

  it('rejects unknown permissions', async () => {
    permissionFindMany.mockResolvedValue([]);
    await expect(service.createRole({ name: 'Support', permissionIds: ['missing'] })).rejects.toThrow(BadRequestException);
    expect(roleCreate).not.toHaveBeenCalled();
  });

  it('rejects duplicate permission IDs', async () => {
    await expect(service.createRole({ name: 'Support', permissionIds: ['p1', 'p1'] })).rejects.toThrow(BadRequestException);
  });

  it('rejects reserved Owner name', async () => {
    await expect(service.createRole({ name: 'owner', permissionIds: [] })).rejects.toThrow(BadRequestException);
  });

  it('reports duplicate role names', async () => {
    permissionFindMany.mockResolvedValue([]);
    roleCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Duplicate role', { code: 'P2002', clientVersion: 'test' }));
    await expect(service.createRole({ name: 'Support', permissionIds: [] })).rejects.toThrow(ConflictException);
  });
});

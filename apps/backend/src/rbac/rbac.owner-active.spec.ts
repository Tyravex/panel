import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RbacService } from './rbac.service';

describe('RbacService active Owner protection', () => {
  const tx = {
    $queryRaw: jest.fn(),
    role: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    userRole: { findUnique: jest.fn(), count: jest.fn(), delete: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const service = new RbacService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    tx.role.findUnique.mockResolvedValue({ id: 'owner-role', name: 'Owner' });
    tx.user.findUnique.mockResolvedValue({ id: 2, isActive: true });
    tx.userRole.findUnique.mockResolvedValue({ userId: 2, roleId: 'owner-role' });
    tx.userRole.count.mockResolvedValue(1);
    tx.userRole.delete.mockResolvedValue({ userId: 2, roleId: 'owner-role' });
  });

  it('protects the last active Owner', async () => {
    await expect(service.revokeRole(2, 'owner-role')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.userRole.delete).not.toHaveBeenCalled();
    expect(tx.userRole.count).toHaveBeenCalledWith({
      where: { role: { name: 'Owner' }, user: { isActive: true } },
    });
  });

  it('allows revocation when multiple active Owners exist', async () => {
    tx.userRole.count.mockResolvedValue(2);
    await service.revokeRole(2, 'owner-role');
    expect(tx.userRole.delete).toHaveBeenCalledWith({
      where: { userId_roleId: { userId: 2, roleId: 'owner-role' } },
    });
  });

  it('allows removing Owner from a disabled user when only one active Owner remains', async () => {
    tx.user.findUnique.mockResolvedValue({ id: 2, isActive: false });
    await service.revokeRole(2, 'owner-role');
    expect(tx.userRole.delete).toHaveBeenCalledTimes(1);
  });

  it('rejects missing Owner assignments', async () => {
    tx.userRole.findUnique.mockResolvedValue(null);
    await expect(service.revokeRole(2, 'owner-role')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.userRole.delete).not.toHaveBeenCalled();
  });
});

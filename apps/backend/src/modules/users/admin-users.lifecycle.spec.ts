import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService lifecycle', () => {
  const tx = { $queryRaw: jest.fn(), user: { findUnique: jest.fn(), count: jest.fn(), update: jest.fn() }, session: { updateMany: jest.fn() } };
  const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)), user: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() } };
  const service = new AdminUsersService(prisma as never);
  beforeEach(() => { jest.clearAllMocks(); tx.user.findUnique.mockResolvedValue({ id: 2, isActive: true, roles: [] }); tx.user.update.mockResolvedValue({ id: 2, isActive: false }); tx.session.updateMany.mockResolvedValue({ count: 2 }); });

  it('rejects invalid creation data', async () => {
    await expect(service.create({ username: 'x', email: 'a@b.com', password: 'long-enough-password' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ username: 'tester', email: 'a@b.com', password: 'short' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not allow an administrator to disable themselves', async () => {
    await expect(service.setActive(2, false, 2)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prevents disabling the last active Owner', async () => {
    tx.user.findUnique.mockResolvedValue({ id: 2, isActive: true, roles: [{ role: { name: 'Owner' } }] });
    tx.user.count.mockResolvedValue(1);
    await expect(service.setActive(2, false, 1)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('revokes sessions atomically when disabling an account', async () => {
    await service.setActive(2, false, 1);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false } }));
    expect(tx.session.updateMany).toHaveBeenCalledWith({ where: { userId: 2, revokedAt: null }, data: { revokedAt: expect.any(Date) } });
  });

  it('does not revoke sessions when enabling an account', async () => {
    await service.setActive(2, true, 1);
    expect(tx.session.updateMany).not.toHaveBeenCalled();
  });
});

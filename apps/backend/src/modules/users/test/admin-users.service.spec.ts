import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminUsersService } from '../admin-users.service';

describe('AdminUsersService', () => {
  const prisma = {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new AdminUsersService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns a paginated, safe user list', async () => {
    prisma.user.count.mockReturnValue(Promise.resolve(1));
    prisma.user.findMany.mockReturnValue(Promise.resolve([{ id: 1, username: 'tester' }]));
    prisma.$transaction.mockResolvedValue([1, [{ id: 1, username: 'tester' }]]);
    const result = await service.list('1', 'test');
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20, select: expect.not.objectContaining({ password: true }) }),
    );
  });

  it('rejects invalid pages', async () => {
    await expect(service.list('0')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list('abc')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversized search', async () => {
    await expect(service.list('1', 'x'.repeat(101))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 for a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.get(123)).rejects.toBeInstanceOf(NotFoundException);
  });
});

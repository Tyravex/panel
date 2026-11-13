import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminUsersService } from '../admin-users.service';

describe('AdminUsersService account services', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    service: { findMany: jest.fn() },
  };

  const service = new AdminUsersService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 9 });
  });

  it('returns owned and shared services with minimal fields', async () => {
    prisma.service.findMany.mockResolvedValue([
      { id: 'svc-1', name: 'Alpha', userId: 9 },
      { id: 'svc-2', name: 'Beta', userId: 12 },
    ]);

    await expect(service.getServices(9)).resolves.toEqual([
      { id: 'svc-1', name: 'Alpha', access: 'Owner' },
      { id: 'svc-2', name: 'Beta', access: 'Member' },
    ]);

    expect(prisma.service.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: 9 },
          { members: { some: { userId: 9 } } },
        ],
      },
      select: {
        id: true,
        name: true,
        userId: true,
      },
      orderBy: [
        { name: 'asc' },
        { id: 'asc' },
      ],
    });
  });

  it('prioritizes ownership if the user is also a member', async () => {
    prisma.service.findMany.mockResolvedValue([
      { id: 'svc-1', name: 'Alpha', userId: 9 },
    ]);

    await expect(service.getServices(9)).resolves.toEqual([
      { id: 'svc-1', name: 'Alpha', access: 'Owner' },
    ]);

    expect(prisma.service.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list when there are no services', async () => {
    prisma.service.findMany.mockResolvedValue([]);

    await expect(service.getServices(9)).resolves.toEqual([]);
  });

  it('returns 404 for a missing user without querying services', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getServices(9)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.service.findMany).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid user ID %p',
    async (id) => {
      await expect(service.getServices(id)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.service.findMany).not.toHaveBeenCalled();
    },
  );
});

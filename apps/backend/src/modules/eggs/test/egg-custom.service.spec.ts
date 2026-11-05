import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '@/prisma/prisma.service';
import { EggsService } from '../eggs.service';

// Use a manifest that conforms to the current validator in the repository.
// The mocked database is never called when validation fails.
describe('EggsService custom ownership boundaries', () => {
  it('rejects an invalid authenticated owner before database access', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new EggsService(prisma as unknown as PrismaService);
    await expect(service.createCustomEgg(0, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lists only custom Eggs owned by the authenticated user', async () => {
    const prisma = { egg: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new EggsService(prisma as unknown as PrismaService);
    await expect(service.listMyEggs(42)).resolves.toEqual([]);
    expect(prisma.egg.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: 42, sourceType: 'CUSTOM' },
      }),
    );
  });

  it('does not query the database for an invalid owner', async () => {
    const prisma = { egg: { findMany: jest.fn() } };
    const service = new EggsService(prisma as unknown as PrismaService);
    await expect(service.listMyEggs(-1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.egg.findMany).not.toHaveBeenCalled();
  });
});

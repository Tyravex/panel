import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EggsService } from '../eggs.service';
import type { PrismaService } from '@/prisma/prisma.service';

describe('EggsService.setEggApproval', () => {
  const eggId = 'egg-1';
  const repositoryId = 'repo-1';
  const original = {
    id: eggId,
    key: 'test',
    version: '1.0.0',
    approvalStatus: 'APPROVED' as const,
    approvedAt: new Date('2026-01-01T00:00:00Z'),
    isEnabled: true,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  function setup(egg: typeof original | null = original) {
    const tx = {
      egg: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ repositoryId })
          .mockResolvedValueOnce(egg),
        update: jest.fn().mockImplementation(async ({ data }) => ({
          ...egg, ...data, updatedAt: new Date('2026-01-02T00:00:00Z'),
        })),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: repositoryId }]),
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new EggsService(prisma as unknown as PrismaService);
    return { service, tx };
  }

  it('rejects invalid decisions before accessing the database', async () => {
    const { service } = setup();
    await expect(service.setEggApproval(1, eggId, 'PENDING' as never))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects and disables an active Egg in one transaction', async () => {
    const { service, tx } = setup();
    const result = await service.setEggApproval(1, eggId, 'REJECTED');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.egg.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: eggId },
      data: {
        approvalStatus: 'REJECTED',
        approvedAt: null,
        isEnabled: false,
      },
    }));
    expect(result.isEnabled).toBe(false);
    expect(tx.adminAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it('approves without enabling an Egg', async () => {
    const { service, tx } = setup({ ...original, isEnabled: false });
    await service.setEggApproval(1, eggId, 'APPROVED');
    // An already approved and disabled Egg is an idempotent no-op.
    expect(tx.egg.update).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('does not write audit entries for repeated rejection', async () => {
    const { service, tx } = setup({
      ...original, approvalStatus: 'REJECTED' as never,
      isEnabled: false, approvedAt: null as never,
    });
    await service.setEggApproval(1, eggId, 'REJECTED');
    expect(tx.egg.update).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('returns 404 if the Egg disappears after locking', async () => {
    const { service, tx } = setup(null);
    await expect(service.setEggApproval(1, eggId, 'REJECTED'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(tx.egg.update).not.toHaveBeenCalled();
  });
});

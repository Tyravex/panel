import { NotFoundException } from '@nestjs/common';

import { ServicesService } from '../services.service';

describe('ServicesService getMembers ownership authorization', () => {
  const serviceId = 'service-1';
  const ownerId = 101;

  it('reads members through one ownership-filtered service query', async () => {
    const members = [
      {
        userId: 202,
        permissions: ['service:view'],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        user: { id: 202, username: 'member' },
      },
    ];

    const findFirst = jest.fn().mockResolvedValue({ members });
    const findMany = jest.fn();

    const prisma = {
      service: { findFirst },
      serviceMember: { findMany },
    };

    const service = new ServicesService(prisma as never);

    await expect(service.getMembers(serviceId, ownerId)).resolves.toEqual(
      members,
    );

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: serviceId, userId: ownerId },
      select: {
        members: {
          select: {
            userId: true,
            permissions: true,
            createdAt: true,
            updatedAt: true,
            user: {
              select: { id: true, username: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    expect(findMany).not.toHaveBeenCalled();
  });

  it('does not return members when the service is not owned by the caller', async () => {
    const prisma = {
      service: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      serviceMember: {
        findMany: jest.fn(),
      },
    };

    const service = new ServicesService(prisma as never);

    await expect(
      service.getMembers(serviceId, ownerId),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.serviceMember.findMany).not.toHaveBeenCalled();
  });
});
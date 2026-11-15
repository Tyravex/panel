import { NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaService } from '@/prisma/prisma.service';
import { requireIntegrationDatabase } from '@/test/test-database.guard';
import { ServicesService } from '../services.service';

const integrationUrl = requireIntegrationDatabase();

describe('ServicesService membership ownership races - PostgreSQL', () => {
  jest.setTimeout(30000);

  let prisma: PrismaClient;
  let secondConnection: PrismaClient;
  let service: ServicesService;

  let oldOwnerId: number;
  let newOwnerId: number;
  let memberId: number;
  let serviceId: string;
  let categoryId: string;

  const runId =
    `membership-race-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const delay = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  async function assertTestDatabase(client: PrismaClient) {
    const rows = await client.$queryRaw<
      Array<{ database: string; schema: string }>
    >`SELECT current_database() AS database, current_schema() AS schema`;

    if (
      rows[0]?.database !== 'tyravex_integration' ||
      rows[0]?.schema !== 'public'
    ) {
      throw new Error('Refusing to use an unexpected database/schema');
    }
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: integrationUrl }),
    });

    secondConnection = new PrismaClient({
      adapter: new PrismaPg({ connectionString: integrationUrl }),
    });

    await prisma.$connect();
    await secondConnection.$connect();

    await assertTestDatabase(prisma);
    await assertTestDatabase(secondConnection);

    const oldOwner = await prisma.user.create({
      data: {
        username: `${runId}-old`,
        email: `${runId}-old@example.invalid`,
        password: 'integration-test-only',
      },
      select: { id: true },
    });

    const newOwner = await prisma.user.create({
      data: {
        username: `${runId}-new`,
        email: `${runId}-new@example.invalid`,
        password: 'integration-test-only',
      },
      select: { id: true },
    });

    const member = await prisma.user.create({
      data: {
        username: `${runId}-member`,
        email: `${runId}-member@example.invalid`,
        password: 'integration-test-only',
      },
      select: { id: true },
    });

    oldOwnerId = oldOwner.id;
    newOwnerId = newOwner.id;
    memberId = member.id;

    const category = await prisma.serviceCategory.create({
      data: {
        key: `${runId}-category`,
        name: `${runId} category`,
      },
      select: { id: true },
    });

    categoryId = category.id;

    const created = await prisma.service.create({
      data: {
        name: `${runId} service`,
        categoryId,
        userId: oldOwnerId,
      },
      select: { id: true },
    });

    serviceId = created.id;

    service = new ServicesService(
      secondConnection as unknown as PrismaService,
    );
  });

  afterAll(async () => {
    try {
      if (prisma && serviceId) {
        await prisma.serviceMember.deleteMany({
          where: { serviceId },
        });

        await prisma.adminAuditLog.deleteMany({
          where: {
            action: 'SERVICE_OWNER_CHANGED',
            targetType: 'SERVICE',
            targetId: serviceId,
          },
        });

        await prisma.service.deleteMany({
          where: { id: serviceId },
        });
      }

      if (prisma && categoryId) {
        await prisma.serviceCategory.deleteMany({
          where: { id: categoryId },
        });
      }

      if (prisma) {
        const ids = [oldOwnerId, newOwnerId, memberId].filter(
          (id): id is number => typeof id === 'number',
        );

        if (ids.length > 0) {
          await prisma.user.deleteMany({
            where: { id: { in: ids } },
          });
        }
      }
    } finally {
      await secondConnection?.$disconnect();
      await prisma?.$disconnect();
    }
  });

  beforeEach(async () => {
    await prisma.serviceMember.deleteMany({
      where: { serviceId },
    });

    await prisma.service.update({
      where: { id: serviceId },
      data: { userId: oldOwnerId },
    });
  });

  it('rejects old-owner membership changes after owner transfer commits', async () => {
    let releaseTransfer!: () => void;

    const transferGate = new Promise<void>((resolve) => {
      releaseTransfer = resolve;
    });

    let signalLocked!: () => void;

    const locked = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });

    const transfer = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Service"
          WHERE "id" = ${serviceId}
          FOR UPDATE
        `;

        signalLocked();
        await transferGate;

        await tx.service.update({
          where: { id: serviceId },
          data: { userId: newOwnerId },
        });
      },
      { timeout: 15000 },
    );

    await locked;

    const addition = service.addMember(
      serviceId,
      oldOwnerId,
      {
        userId: memberId,
        permissions: ['service:view'],
      },
    );

    try {
      // Give the second transaction an opportunity to reach the lock.
      await delay(150);
    } finally {
      releaseTransfer();
    }

    await transfer;

    await expect(addition).rejects.toThrow(NotFoundException);

    expect(
      await prisma.serviceMember.count({
        where: { serviceId, userId: memberId },
      }),
    ).toBe(0);

    expect(
      (
        await prisma.service.findUniqueOrThrow({
          where: { id: serviceId },
          select: { userId: true },
        })
      ).userId,
    ).toBe(newOwnerId);
  });

  it('makes owner transfer wait for a membership transaction lock', async () => {
    let releaseMembership!: () => void;

    const membershipGate = new Promise<void>((resolve) => {
      releaseMembership = resolve;
    });

    let signalLocked!: () => void;

    const locked = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });

    const membership = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Service"
          WHERE "id" = ${serviceId}
            AND "userId" = ${oldOwnerId}
          FOR UPDATE
        `;

        signalLocked();

        await membershipGate;

        await tx.serviceMember.create({
          data: {
            serviceId,
            userId: memberId,
            permissions: ['service:view'],
          },
        });
      },
      { timeout: 15000 },
    );

    await locked;

    let transferFinished = false;

    const transfer = service
      .setOwner(serviceId, oldOwnerId, {
        userId: newOwnerId,
      })
      .then((result) => {
        transferFinished = true;
        return result;
      });

    try {
      await delay(150);

      expect(transferFinished).toBe(false);
    } finally {
      releaseMembership();
    }

    await membership;
    await transfer;

    expect(transferFinished).toBe(true);

    expect(
      (
        await prisma.service.findUniqueOrThrow({
          where: { id: serviceId },
          select: { userId: true },
        })
      ).userId,
    ).toBe(newOwnerId);

    expect(
      await prisma.serviceMember.count({
        where: { serviceId, userId: memberId },
      }),
    ).toBe(1);
  });
});
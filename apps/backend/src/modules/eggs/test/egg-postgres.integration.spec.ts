import { requireIntegrationDatabase } from '@/test/test-database.guard';
import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaService } from '@/prisma/prisma.service';
import { EggsService } from '../eggs.service';

// The shared guard rejects application databases and non-local targets.
const integrationUrl = requireIntegrationDatabase();
const integrationDescribe = describe;

integrationDescribe('Eggs PostgreSQL integration (B.6.9)', () => {
  let prisma: PrismaClient;
  let service: EggsService;
  let firstUserId: number;
  let secondUserId: number;
  const repositoryIds = new Set<string>();
  const eggIds = new Set<string>();
  const runId = `b69-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const manifest = (id: string, version = '1.0.0') => ({
    format: 'tyravex-egg',
    formatVersion: 1,
    id,
    name: `Integration ${id}`,
    version,
    category: 'other',
    runtime: { image: 'alpine:3.20', startup: 'echo ready' },
    resources: { memoryMb: 128, cpuPercent: 100, diskMb: 256 },
  });

  async function submit(userId: number, id: string, version = '1.0.0') {
    const egg = await service.createCustomEgg(userId, manifest(id, version));
    eggIds.add(egg.id);
    repositoryIds.add(egg.repositoryId);
    return egg;
  }

  beforeAll(async () => {
    // This connection is independent of the application's runtime environment.
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: integrationUrl! }),
    });
    await prisma.$connect();
    const database = await prisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database()
    `;
    if (database[0]?.current_database !== 'tyravex_integration') {
      throw new Error('Connected to an unexpected PostgreSQL database');
    }
    service = new EggsService(prisma as unknown as PrismaService);

    const first = await prisma.user.create({
      data: {
        username: `${runId}-a`,
        email: `${runId}-a@example.invalid`,
        password: 'integration-test-not-a-login',
      },
      select: { id: true },
    });
    firstUserId = first.id;
    const second = await prisma.user.create({
      data: {
        username: `${runId}-b`,
        email: `${runId}-b@example.invalid`,
        password: 'integration-test-not-a-login',
      },
      select: { id: true },
    });
    secondUserId = second.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      // Remove only records created by this test run.
      const users = [firstUserId, secondUserId].filter(Number.isInteger);
      const owned = await prisma.egg.findMany({
        where: { ownerId: { in: users }, sourceType: 'CUSTOM' },
        select: { id: true, repositoryId: true },
      });
      for (const egg of owned) {
        eggIds.add(egg.id);
        repositoryIds.add(egg.repositoryId);
      }
      const targets = [...eggIds];
      if (targets.length) {
        await prisma.adminAuditLog.deleteMany({
          where: { targetType: 'EGG', targetId: { in: targets } },
        });
        await prisma.egg.deleteMany({ where: { id: { in: targets } } });
      }
      if (repositoryIds.size) {
        await prisma.eggRepository.deleteMany({
          where: { id: { in: [...repositoryIds] } },
        });
      }
      if (users.length) {
        await prisma.user.deleteMany({ where: { id: { in: users } } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('persists safe defaults and ownership', async () => {
    const egg = await submit(firstUserId, `${runId}-defaults`);
    const persisted = await prisma.egg.findUniqueOrThrow({ where: { id: egg.id } });
    expect(persisted.ownerId).toBe(firstUserId);
    expect(persisted.sourceType).toBe('CUSTOM');
    expect(persisted.approvalStatus).toBe('PENDING');
    expect(persisted.approvedAt).toBeNull();
    expect(persisted.isEnabled).toBe(false);
    expect(await prisma.eggRepository.findUniqueOrThrow({
      where: { id: egg.repositoryId },
    })).toMatchObject({ isOfficial: false, status: 'ENABLED' });
  });

  it('isolates each user and keeps separate repositories', async () => {
    const id = `${runId}-shared`;
    const first = await submit(firstUserId, id);
    const second = await submit(secondUserId, id);
    expect(first.repositoryId).not.toBe(second.repositoryId);
    expect((await service.listMyEggs(firstUserId)).some((egg) => egg.id === second.id)).toBe(false);
    expect((await service.listMyEggs(secondUserId)).some((egg) => egg.id === first.id)).toBe(false);
  });

  it('rejects duplicate key and version in the same repository', async () => {
    const id = `${runId}-duplicate`;
    await submit(firstUserId, id);
    await expect(service.createCustomEgg(firstUserId, manifest(id))).rejects.toBeInstanceOf(
      ConflictException,
    );
    await submit(firstUserId, id, '1.0.1');
  });

  it('approves without enabling, then rejects and disables atomically', async () => {
    const egg = await submit(firstUserId, `${runId}-approval`);
    await expect(service.setEggStatus(firstUserId, egg.id, true)).rejects.toBeInstanceOf(
      ConflictException,
    );
    const approved = await service.setEggApproval(firstUserId, egg.id, 'APPROVED');
    expect(approved.approvalStatus).toBe('APPROVED');
    expect(approved.isEnabled).toBe(false);
    expect(approved.approvedAt).not.toBeNull();
    await service.setEggStatus(firstUserId, egg.id, true);
    const rejected = await service.setEggApproval(firstUserId, egg.id, 'REJECTED');
    expect(rejected.approvalStatus).toBe('REJECTED');
    expect(rejected.isEnabled).toBe(false);
    expect(rejected.approvedAt).toBeNull();
    await expect(service.setEggStatus(firstUserId, egg.id, true)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('serializes concurrent submissions without duplicate rows', async () => {
    const id = `${runId}-parallel`;
    const results = await Promise.allSettled([
      service.createCustomEgg(firstUserId, manifest(id)),
      service.createCustomEgg(firstUserId, manifest(id)),
    ]);
    const successful = results.filter((result) => result.status === 'fulfilled');
    expect(successful).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rows = await prisma.egg.findMany({
      where: { ownerId: firstUserId, key: id, version: '1.0.0' },
      select: { id: true, repositoryId: true },
    });
    expect(rows).toHaveLength(1);
    for (const row of rows) {
      eggIds.add(row.id);
      repositoryIds.add(row.repositoryId);
    }
  });
});

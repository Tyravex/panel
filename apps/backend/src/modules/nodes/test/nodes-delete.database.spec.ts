import { ConflictException, NotFoundException } from '@nestjs/common';
import { JobType, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaService } from '@/prisma/prisma.service';
import { requireIntegrationDatabase } from '@/test/test-database.guard';
import { NodeTokenService } from '../node-token.service';
import { NodeHeartbeatMonitorService } from '../services/node-heartbeat-monitor.service';
import { NodesService } from '../nodes.service';

const integrationUrl = requireIntegrationDatabase();

describe('NodesService DELETE - PostgreSQL integration', () => {
  let prisma: PrismaClient;
  let service: NodesService;
  let actorId: number;

  const runId = `node-delete-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const nodeIds = new Set<string>();
  const serviceIds = new Set<string>();
  const commandIds = new Set<string>();
  const jobIds = new Set<string>();
  let categoryId: string | undefined;

  async function createNode(label: string): Promise<string> {
    const node = await prisma.node.create({
      data: {
        name: `${runId}-${label}`,
        tokenHash: `${runId}-${label}-hash`,
      },
      select: { id: true },
    });

    nodeIds.add(node.id);
    return node.id;
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: integrationUrl }),
    });

    await prisma.$connect();

    const database = await prisma.$queryRaw<
      Array<{ database: string; schema: string }>
    >`SELECT current_database() AS database, current_schema() AS schema`;

    if (
      database[0]?.database !== 'tyravex_integration' ||
      database[0]?.schema !== 'public'
    ) {
      throw new Error('Refusing to test against an unexpected database/schema');
    }

    service = new NodesService(
      prisma as unknown as PrismaService,
      {} as NodeTokenService,
      {} as NodeHeartbeatMonitorService,
    );

    const actor = await prisma.user.create({
      data: {
        username: `${runId}-actor`,
        email: `${runId}-actor@example.invalid`,
        password: 'integration-test-placeholder-not-a-login',
      },
      select: { id: true },
    });

    actorId = actor.id;
  });

  afterAll(async () => {
    if (!prisma) return;

    try {
      // Only records created by this test run may be removed.
      if (commandIds.size) {
        await prisma.agentCommand.deleteMany({
          where: { id: { in: [...commandIds] } },
        });
      }

      if (jobIds.size) {
        await prisma.job.deleteMany({
          where: { id: { in: [...jobIds] } },
        });
      }

      if (serviceIds.size) {
        await prisma.service.deleteMany({
          where: { id: { in: [...serviceIds] } },
        });
      }

      if (nodeIds.size) {
        await prisma.adminAuditLog.deleteMany({
          where: {
            action: 'NODE_DELETED',
            targetType: 'NODE',
            targetId: { in: [...nodeIds] },
          },
        });

        await prisma.node.deleteMany({
          where: { id: { in: [...nodeIds] } },
        });
      }

      if (categoryId) {
        await prisma.serviceCategory.deleteMany({
          where: { id: categoryId },
        });
      }

      if (Number.isInteger(actorId)) {
        await prisma.user.deleteMany({
          where: { id: actorId },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('returns 404 for a missing Node', async () => {
    await expect(
      service.deleteNode(`${runId}-missing`, actorId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 409 and preserves a Node assigned to a Service', async () => {
    const nodeId = await createNode('with-service');

    const category = await prisma.serviceCategory.create({
      data: {
        key: `${runId}-category`,
        name: `${runId} category`,
      },
      select: { id: true },
    });

    categoryId = category.id;

    const assigned = await prisma.service.create({
      data: {
        name: `${runId} service`,
        categoryId: category.id,
        nodeId,
      },
      select: { id: true },
    });

    serviceIds.add(assigned.id);

    await expect(
      service.deleteNode(nodeId, actorId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(await prisma.node.findUnique({ where: { id: nodeId } }))
      .not.toBeNull();
  });

  it('returns 409 and preserves a Node with AgentCommand history', async () => {
    const nodeId = await createNode('with-command');

    const jobType = Object.values(JobType)[0];

    if (!jobType) {
      throw new Error('JobType enum has no values');
    }

    const job = await prisma.job.create({
      data: {
        type: jobType,
        userId: actorId,
      },
      select: { id: true },
    });

    jobIds.add(job.id);

    const command = await prisma.agentCommand.create({
      data: {
        jobId: job.id,
        nodeId,
        serviceId: `${runId}-command-service`,
        operation: 'INSTALL',
        jobCommandKey: `${runId}-command-key`,
      },
      select: { id: true },
    });

    commandIds.add(command.id);

    await expect(
      service.deleteNode(nodeId, actorId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(await prisma.node.findUnique({ where: { id: nodeId } }))
      .not.toBeNull();
  });

  it('deletes an empty Node and persists exactly one audit entry', async () => {
    const nodeId = await createNode('success');

    await expect(service.deleteNode(nodeId, actorId))
      .resolves.toEqual({ success: true });

    expect(await prisma.node.findUnique({ where: { id: nodeId } }))
      .toBeNull();

    const audits = await prisma.adminAuditLog.findMany({
      where: {
        action: 'NODE_DELETED',
        targetType: 'NODE',
        targetId: nodeId,
      },
    });

    expect(audits).toHaveLength(1);
    expect(audits[0].actorId).toBe(actorId);
    expect(audits[0].metadata).toEqual(
      expect.objectContaining({ name: `${runId}-success` }),
    );
  });

  it('rolls back Node deletion if the audit insert violates its actor FK', async () => {
    const nodeId = await createNode('audit-rollback');

    // Deliberately invalid actor: the audit INSERT must fail.
    // PostgreSQL must roll back the earlier Node DELETE.
    const nonexistentActor = -2147483647;

    await expect(
      service.deleteNode(nodeId, nonexistentActor),
    ).rejects.toThrow();

    expect(await prisma.node.findUnique({ where: { id: nodeId } }))
      .not.toBeNull();

    expect(
      await prisma.adminAuditLog.count({
        where: {
          action: 'NODE_DELETED',
          targetType: 'NODE',
          targetId: nodeId,
        },
      }),
    ).toBe(0);
  });
});
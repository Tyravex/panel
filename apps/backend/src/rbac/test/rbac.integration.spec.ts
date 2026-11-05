import 'dotenv/config';
import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaService } from '@/prisma/prisma.service';
import { requireIntegrationDatabase } from '../../test/test-database.guard';
import { RbacService } from '../rbac.service';

describe('RbacService PostgreSQL concurrency', () => {
    let prisma: PrismaClient;
    let service: RbacService;

    beforeAll(async () => {
        const connectionString = requireIntegrationDatabase();

        prisma = new PrismaClient({
            adapter: new PrismaPg({ connectionString }),
        });
        await prisma.$connect();
        service = new RbacService(prisma as PrismaService);
    });

    afterAll(async () => {
        await prisma?.$disconnect();
    });

    it('preserves one Owner during concurrent revocations', async () => {
        const { randomUUID } = await import('node:crypto');
        const ownerRole = await prisma.role.upsert({
            where: { name: 'Owner' }, create: { name: 'Owner' }, update: {},
        });
        const existingOwners = await prisma.userRole.count({ where: { roleId: ownerRole.id } });
        if (existingOwners !== 0) {
            throw new Error('Owner concurrency test requires a fresh integration DB with no pre-existing Owner assignments.');
        }
        const suffix = randomUUID();
        const users = await Promise.all([1, 2].map(i => prisma.user.create({
            data: { username: `rbac-owner-${i}-${suffix}`, email: `rbac-owner-${i}-${suffix}@example.invalid`, password: 'test-only' },
        })));
        try {
            for (const user of users) {
                await prisma.userRole.create({ data: { userId: user.id, roleId: ownerRole.id } });
            }
            const results = await Promise.allSettled(users.map(user => service.revokeRole(user.id, ownerRole.id)));
            expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
            const rejected = results.filter(result => result.status === 'rejected');
            expect(rejected).toHaveLength(1);
            expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestException);
            expect(await prisma.userRole.count({ where: { roleId: ownerRole.id } })).toBe(1);
        } finally {
            await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: users.map(u => u.id) } } });
            await prisma.userRole.deleteMany({ where: { userId: { in: users.map(u => u.id) } } });
            await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
        }
    });
});

import 'dotenv/config';
import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaService } from '@/prisma/prisma.service';
import { RbacService } from '../rbac.service';

describe('RbacService PostgreSQL concurrency', () => {
    let prisma: PrismaClient;
    let service: RbacService;

    beforeAll(async () => {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
            throw new Error('DATABASE_URL is required');
        }

        const databaseName = new URL(connectionString).pathname.slice(1);

        // Never run destructive integration tests against the main database.
        if (databaseName !== 'tyravex_rbac_test') {
            throw new Error(
                'Integration tests require the tyravex_rbac_test database',
            );
        }

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
        const ownerRole = await prisma.role.findUniqueOrThrow({
            where: { name: 'Owner' },
        });

        const users = await prisma.user.findMany({
            where: {
                username: {
                    in: ['rbac_test_owner_1', 'rbac_test_owner_2'],
                },
            },
            orderBy: { id: 'asc' },
        });

        expect(users).toHaveLength(2);

        // Restore both assignments before the concurrency test.
        for (const user of users) {
            await prisma.userRole.upsert({
                where: {
                    userId_roleId: {
                        userId: user.id,
                        roleId: ownerRole.id,
                    },
                },
                update: {},
                create: {
                    userId: user.id,
                    roleId: ownerRole.id,
                },
            });
        }


        const results = await Promise.allSettled(
            users.map((user) => service.revokeRole(user.id, ownerRole.id)),
        );

        const successful = results.filter(
            (result) => result.status === 'fulfilled',
        );

        const rejected = results.filter(
            (result) => result.status === 'rejected',
        );

        expect(successful).toHaveLength(1);

        expect(rejected).toHaveLength(1);

        expect(
            (rejected[0] as PromiseRejectedResult).reason,
        ).toBeInstanceOf(BadRequestException);

        const remainingOwners = await prisma.userRole.count({
            where: {
                roleId: ownerRole.id,
            },
        });

        expect(remainingOwners).toBe(1);
    });
});
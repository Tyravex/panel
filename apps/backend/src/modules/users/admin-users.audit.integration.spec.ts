import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminUsersService } from './admin-users.service';

describe('Admin users audit rollback (real PostgreSQL)', () => {
    let prisma: PrismaService;
    let service: AdminUsersService;

    beforeAll(async () => {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is required for this integration test.');
        }
        prisma = new PrismaService();
        await prisma.$connect();
        service = new AdminUsersService(prisma);
    });

    afterAll(async () => {
        await prisma?.$disconnect();
    });

    it('rolls back user creation when the audit insert fails', async () => {
        // A missing actor triggers a real foreign-key error during audit insertion.
        const missingActorId = 2147483647;
        const suffix = randomUUID().replace(/-/g, '').slice(0, 18);
        const username = `audit_${suffix}`;
        const email = `${username}@example.invalid`;

        const actor = await prisma.user.findUnique({
            where: { id: missingActorId },
            select: { id: true },
        });
        if (actor) {
            throw new Error('Reserved test actor ID exists; aborting without changes.');
        }

        try {
            await expect(
                service.create(
                    { username, email, password: 'TestOnlyPassword123!' },
                    missingActorId,
                ),
            ).rejects.toThrow();

            // The user insert preceded the failed audit insert in one transaction.
            expect(
                await prisma.user.findUnique({
                    where: { username },
                    select: { id: true },
                }),
            ).toBeNull();

            expect(
                await prisma.adminAuditLog.count({
                    where: {
                        action: 'USER_CREATED',
                        actorId: missingActorId,
                        metadata: { path: ['username'], equals: username },
                    },
                }),
            ).toBe(0);
        } finally {
            // Remove only our unique test user if a regression committed it.
            const leftover = await prisma.user.findUnique({
                where: { username },
                select: { id: true },
            });
            if (leftover) {
                await prisma.user.delete({ where: { id: leftover.id } });
            }
        }
    });
});

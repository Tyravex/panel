import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { RbacService } from '../rbac.service';

describe('RBAC audit transaction rollback (real PostgreSQL)', () => {
    let prisma: PrismaService;
    let service: RbacService;

    beforeAll(async () => {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is required for the PostgreSQL integration test.');
        }
        prisma = new PrismaService();
        await prisma.$connect();
        service = new RbacService(prisma);
    });

    afterAll(async () => {
        await prisma?.$disconnect();
    });

    it('rolls back role creation when audit insert violates actor foreign key', async () => {
        // An intentionally missing actor triggers a genuine PostgreSQL FK failure.
        // No triggers, schema changes or manual transaction mocks are involved.
        const missingActorId = 2147483647;
        const name = `AuditRollback_${randomUUID().replace(/-/g, '').slice(0, 20)}`;

        const existingActor = await prisma.user.findUnique({
            where: { id: missingActorId },
            select: { id: true },
        });
        if (existingActor) {
            throw new Error(`Reserved test actor ID ${missingActorId} exists; aborting safely.`);
        }

        try {
            await expect(
                service.createRole({ name, permissionIds: [] }, missingActorId),
            ).rejects.toThrow();

            // If the audit insert fails inside the same transaction, the role
            // created earlier in that transaction must not survive.
            const persistedRole = await prisma.role.findUnique({
                where: { name },
                select: { id: true },
            });
            expect(persistedRole).toBeNull();

            const auditEntries = await prisma.adminAuditLog.count({
                where: {
                    actorId: missingActorId,
                    action: 'ROLE_CREATED',
                    metadata: { path: ['name'], equals: name },
                },
            });
            expect(auditEntries).toBe(0);
        } finally {
            // Defensive cleanup in case a regression unexpectedly commits the role.
            // Only touches the uniquely named test role, never existing data.
            const leftover = await prisma.role.findUnique({
                where: { name },
                select: { id: true },
            });
            if (leftover) {
                await prisma.role.delete({ where: { id: leftover.id } });
            }
        }
    });
});

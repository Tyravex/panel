import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class RbacService {
    constructor(private readonly prisma: PrismaService) { }

    async revokeRole(userId: number, roleId: string): Promise<void> {
        if (!Number.isSafeInteger(userId) || userId <= 0 || !roleId) {
            throw new BadRequestException('Invalid user or role ID');
        }

        await this.prisma.$transaction(async (tx) => {
            // Serialize RBAC operations that can change Owner membership.
            // Cast PostgreSQL's void result to text for Prisma compatibility.
            await tx.$queryRaw<{ lock_result: string }[]>`
                SELECT pg_advisory_xact_lock(847201, 1)::text AS lock_result
            `;

            const role = await tx.role.findUnique({
                where: { id: roleId },
            });

            if (!role) {
                throw new NotFoundException('Role not found');
            }

            const membership = await tx.userRole.findUnique({
                where: {
                    userId_roleId: { userId, roleId },
                },
            });

            if (!membership) {
                throw new NotFoundException('Role assignment not found');
            }

            if (role.name === 'Owner') {
                const ownerCount = await tx.userRole.count({
                    where: {
                        role: { name: 'Owner' },
                    },
                });

                if (ownerCount <= 1) {
                    throw new BadRequestException('Cannot revoke the last Owner role');
                }
            }

            await tx.userRole.delete({
                where: {
                    userId_roleId: { userId, roleId },
                },
            });
        });
    }
}

import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class RbacService {
    constructor(private readonly prisma: PrismaService) {}

    async listPermissions() {
        return this.prisma.permission.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
    }

    async createRole(input: { name?: string; permissionIds?: string[] }) {
        const name = typeof input?.name === 'string' ? input.name.trim() : '';
        const ids = input?.permissionIds;
        if (!/^[A-Za-z][A-Za-z0-9 _-]{2,49}$/.test(name)) {
            throw new BadRequestException('Role name must be 3-50 characters (letters, numbers, spaces, _ or -)');
        }
        // Built-in Owner privileges must not be reproduced by creating a new Owner role.
        if (name.toLowerCase() === 'owner') {
            throw new BadRequestException('Owner is a reserved role name');
        }
        if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
            throw new BadRequestException('Invalid permission IDs');
        }
        const available = await this.prisma.permission.findMany({
            where: { id: { in: ids } }, select: { id: true },
        });
        if (available.length !== ids.length) {
            throw new BadRequestException('Unknown permission ID');
        }
        try {
            // Connect only existing permissions; clients cannot invent new privileges.
            return await this.prisma.role.create({
                data: { name, permissions: { connect: ids.map((id) => ({ id })) } },
                select: { id: true, name: true, permissions: { select: { id: true, name: true } } },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException('Role name already exists');
            }
            throw error;
        }
    }

    async updateRole(roleId: string, input: { name?: string; permissionIds?: string[] }) {
        if (!roleId?.trim()) throw new BadRequestException('Invalid role ID');
        const name = typeof input?.name === 'string' ? input.name.trim() : '';
        const ids = input?.permissionIds;
        if (!/^[A-Za-z][A-Za-z0-9 _-]{2,49}$/.test(name) || name.toLowerCase() === 'owner') {
            throw new BadRequestException('Invalid or reserved role name');
        }
        if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
            throw new BadRequestException('Invalid permission IDs');
        }
        // Serialize role changes to avoid modifying the protected Owner role during concurrent operations.
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(847201, 1)::text`;
            const role = await tx.role.findUnique({ where: { id: roleId }, select: { name: true } });
            if (!role) throw new NotFoundException('Role not found');
            if (role.name.toLowerCase() === 'owner') throw new BadRequestException('Cannot edit Owner role');
            const available = await tx.permission.findMany({ where: { id: { in: ids } }, select: { id: true } });
            if (available.length !== ids.length) throw new BadRequestException('Unknown permission ID');
            try {
                // Replace the full permission set atomically, rather than applying partial updates.
                return await tx.role.update({
                    where: { id: roleId },
                    data: { name, permissions: { set: ids.map((id) => ({ id })) } },
                    select: { id: true, name: true, permissions: { select: { id: true, name: true } } },
                });
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                    throw new ConflictException('Role name already exists');
                }
                throw error;
            }
        });
    }

    async deleteRole(roleId: string): Promise<void> {
        if (!roleId?.trim()) throw new BadRequestException('Invalid role ID');
        await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(847201, 1)::text`;
            const role = await tx.role.findUnique({ where: { id: roleId }, select: { name: true } });
            if (!role) throw new NotFoundException('Role not found');
            if (role.name.toLowerCase() === 'owner') throw new BadRequestException('Cannot delete Owner role');
            const assignments = await tx.userRole.count({ where: { roleId } });
            if (assignments > 0) throw new ConflictException('Unassign this role from all users before deleting it');
            await tx.role.delete({ where: { id: roleId } });
        });
    }

    async listRoles() {
        return this.prisma.role.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                permissions: { select: { id: true, name: true } },
                _count: { select: { users: true } },
            },
        });
    }

    async listUserRoles(userId: number) {
        this.validateUserId(userId);
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });
        if (!user) throw new NotFoundException('User not found');
        return this.prisma.userRole.findMany({
            where: { userId },
            select: {
                assignedAt: true,
                role: {
                    select: {
                        id: true,
                        name: true,
                        permissions: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { assignedAt: 'asc' },
        });
    }

    async assignRole(userId: number, roleId: string): Promise<void> {
        this.validateIds(userId, roleId);
        await this.prisma.$transaction(async (tx) => {
            // Keep role membership changes serialized with Owner revocations.
            await tx.$queryRaw<{ lock_result: string }[]>`
                SELECT pg_advisory_xact_lock(847201, 1)::text AS lock_result
            `;
            const [user, role] = await Promise.all([
                tx.user.findUnique({ where: { id: userId }, select: { id: true } }),
                tx.role.findUnique({ where: { id: roleId }, select: { id: true } }),
            ]);
            if (!user) throw new NotFoundException('User not found');
            if (!role) throw new NotFoundException('Role not found');
            await tx.userRole.upsert({
                where: { userId_roleId: { userId, roleId } },
                create: { userId, roleId },
                update: {},
            });
        });
    }

    async revokeRole(userId: number, roleId: string): Promise<void> {
        this.validateIds(userId, roleId);
        await this.prisma.$transaction(async (tx) => {
            // Serialize RBAC operations that can change Owner membership.
            // Cast PostgreSQL's void result to text for Prisma compatibility.
            await tx.$queryRaw<{ lock_result: string }[]>`
                SELECT pg_advisory_xact_lock(847201, 1)::text AS lock_result
            `;
            const role = await tx.role.findUnique({ where: { id: roleId } });
            if (!role) throw new NotFoundException('Role not found');
            const membership = await tx.userRole.findUnique({
                where: { userId_roleId: { userId, roleId } },
            });
            if (!membership) throw new NotFoundException('Role assignment not found');
            if (role.name === 'Owner') {
                const ownerCount = await tx.userRole.count({
                    where: { role: { name: 'Owner' } },
                });
                if (ownerCount <= 1) {
                    throw new BadRequestException('Cannot revoke the last Owner role');
                }
            }
            await tx.userRole.delete({
                where: { userId_roleId: { userId, roleId } },
            });
        });
    }

    private validateUserId(userId: number) {
        if (!Number.isSafeInteger(userId) || userId <= 0) {
            throw new BadRequestException('Invalid user ID');
        }
    }

    private validateIds(userId: number, roleId: string) {
        if (!Number.isSafeInteger(userId) || userId <= 0 || !roleId?.trim()) {
            throw new BadRequestException('Invalid user or role ID');
        }
    }
}

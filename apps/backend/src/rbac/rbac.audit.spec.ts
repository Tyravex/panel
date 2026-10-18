import { BadRequestException, ConflictException } from '@nestjs/common';
import { RbacService } from './rbac.service';

describe('RbacService transactional audit', () => {
    const tx = {
        $queryRaw: jest.fn(),
        permission: { findMany: jest.fn() },
        role: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
        user: { findUnique: jest.fn() },
        userRole: {
            count: jest.fn(),
            findUnique: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn(),
        },
        adminAuditLog: { create: jest.fn() },
    };
    const prisma = {
        $transaction: jest.fn(),
    };
    const service = new RbacService(prisma as never);

    beforeEach(() => {
        jest.resetAllMocks();
        prisma.$transaction.mockImplementation(
            async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
        );
        tx.$queryRaw.mockResolvedValue([]);
        tx.permission.findMany.mockResolvedValue([{ id: 'p1' }]);
        tx.role.findUnique.mockResolvedValue({ id: 'r1', name: 'Support' });
        tx.role.update.mockResolvedValue({ id: 'r1', name: 'Operators', permissions: [] });
        tx.role.delete.mockResolvedValue({ id: 'r1' });
        tx.user.findUnique.mockResolvedValue({ id: 12, isActive: true });
        tx.userRole.count.mockResolvedValue(0);
        tx.userRole.findUnique.mockResolvedValue(null);
        tx.userRole.upsert.mockResolvedValue({ userId: 12, roleId: 'r1' });
        tx.userRole.delete.mockResolvedValue({ userId: 12, roleId: 'r1' });
        tx.adminAuditLog.create.mockResolvedValue({ id: 'audit-1' });
    });

    it('writes ROLE_UPDATED in the role update transaction', async () => {
        await expect(service.updateRole('r1', { name: 'Operators', permissionIds: ['p1'] }, 7))
            .resolves.toMatchObject({ id: 'r1', name: 'Operators' });
        expect(tx.role.update).toHaveBeenCalledTimes(1);
        expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
            data: {
                actorId: 7, action: 'ROLE_UPDATED', targetType: 'ROLE', targetId: 'r1',
                metadata: { previousName: 'Support', name: 'Operators', permissionIds: ['p1'] },
            }
        });
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('writes ROLE_DELETED in the role deletion transaction', async () => {
        await expect(service.deleteRole('r1', 7)).resolves.toBeUndefined();
        expect(tx.role.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
        expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
            data: {
                actorId: 7, action: 'ROLE_DELETED', targetType: 'ROLE', targetId: 'r1',
                metadata: { name: 'Support' },
            }
        });
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('does not delete or audit a role with assigned users', async () => {
        tx.userRole.count.mockResolvedValue(1);
        await expect(service.deleteRole('r1', 7)).rejects.toBeInstanceOf(ConflictException);
        expect(tx.role.delete).not.toHaveBeenCalled();
        expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
    });

    it('writes ROLE_ASSIGNED when the membership is new', async () => {
        await expect(service.assignRole(12, 'r1', 7)).resolves.toBeUndefined();
        expect(tx.userRole.upsert).toHaveBeenCalledWith({
            where: { userId_roleId: { userId: 12, roleId: 'r1' } },
            create: { userId: 12, roleId: 'r1' }, update: {},
        });
        expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
            data: {
                actorId: 7, action: 'ROLE_ASSIGNED', targetType: 'USER', targetId: '12',
                metadata: { roleId: 'r1' },
            }
        });
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('does not write a duplicate audit entry for an existing assignment', async () => {
        tx.userRole.findUnique.mockResolvedValue({ userId: 12, roleId: 'r1' });
        await expect(service.assignRole(12, 'r1', 7)).resolves.toBeUndefined();
        expect(tx.userRole.upsert).toHaveBeenCalledTimes(1);
        expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
    });

    it('writes ROLE_REVOKED when a membership is removed', async () => {
        tx.userRole.findUnique.mockResolvedValue({ userId: 12, roleId: 'r1' });
        await expect(service.revokeRole(12, 'r1', 7)).resolves.toBeUndefined();
        expect(tx.userRole.delete).toHaveBeenCalledWith({
            where: { userId_roleId: { userId: 12, roleId: 'r1' } },
        });
        expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
            data: {
                actorId: 7, action: 'ROLE_REVOKED', targetType: 'USER', targetId: '12',
                metadata: { roleId: 'r1' },
            }
        });
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('does not revoke or audit the last active Owner', async () => {
        tx.role.findUnique.mockResolvedValue({ id: 'owner', name: 'Owner' });
        tx.userRole.findUnique.mockResolvedValue({ userId: 12, roleId: 'owner' });
        tx.userRole.count.mockResolvedValue(1);
        await expect(service.revokeRole(12, 'owner', 7)).rejects.toBeInstanceOf(BadRequestException);
        expect(tx.userRole.delete).not.toHaveBeenCalled();
        expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
    });

    it.each([
        ['update', () => service.updateRole('r1', { name: 'Operators', permissionIds: ['p1'] }, 7)],
        ['delete', () => service.deleteRole('r1', 7)],
        ['assign', () => service.assignRole(12, 'r1', 7)],
        ['revoke', () => {
            tx.userRole.findUnique.mockResolvedValue({ userId: 12, roleId: 'r1' });
            return service.revokeRole(12, 'r1', 7);
        }],
    ])('propagates audit write failures during %s', async (_operation, run) => {
        const failure = new Error('Audit write failed');
        tx.adminAuditLog.create.mockRejectedValueOnce(failure);
        await expect(run()).rejects.toBe(failure);
        expect(tx.adminAuditLog.create).toHaveBeenCalledTimes(1);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
});

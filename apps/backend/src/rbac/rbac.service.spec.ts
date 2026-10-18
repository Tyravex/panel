import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RbacService } from './rbac.service';

describe('RbacService', () => {
    const queryRaw = jest.fn();
    const roleFindUnique = jest.fn();
    const roleFindMany = jest.fn();
    const userFindUnique = jest.fn();
    const membershipFindUnique = jest.fn();
    const membershipFindMany = jest.fn();
    const membershipCount = jest.fn();
    const membershipDelete = jest.fn();
    const membershipUpsert = jest.fn();

    const tx = {
        $queryRaw: queryRaw,
        role: { findUnique: roleFindUnique },
        user: { findUnique: userFindUnique },
        userRole: {
            findUnique: membershipFindUnique,
            count: membershipCount,
            delete: membershipDelete,
            upsert: membershipUpsert,
        },
    };
    const transaction = jest.fn(async (callback) => callback(tx));
    const service = new RbacService({
        $transaction: transaction,
        role: { findMany: roleFindMany },
        user: { findUnique: userFindUnique },
        userRole: { findMany: membershipFindMany },
    } as unknown as PrismaService);

    beforeEach(() => {
        jest.resetAllMocks();
        transaction.mockImplementation(async (callback) => callback(tx));
        roleFindUnique.mockResolvedValue({ id: 'owner-role-id', name: 'Owner' });
        userFindUnique.mockResolvedValue({ id: 1, isActive: true });
        membershipFindUnique.mockResolvedValue({ userId: 1, roleId: 'owner-role-id' });
        queryRaw.mockResolvedValue([]);
    });

    it('lists roles with permissions and membership counts', async () => {
        roleFindMany.mockResolvedValue([{ id: 'a', name: 'Owner', permissions: [], _count: { users: 1 } }]);
        expect(await service.listRoles()).toHaveLength(1);
        expect(roleFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { name: 'asc' } }));
    });

    it('lists user roles', async () => {
        membershipFindMany.mockResolvedValue([{ role: { id: 'a', name: 'Owner' } }]);
        expect(await service.listUserRoles(1)).toHaveLength(1);
        expect(membershipFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 1 } }));
    });

    it('rejects unknown users when listing roles', async () => {
        userFindUnique.mockResolvedValue(null);
        await expect(service.listUserRoles(1)).rejects.toThrow(NotFoundException);
    });

    it('assigns a role using idempotent upsert', async () => {
        await service.assignRole(1, 'owner-role-id');
        expect(membershipUpsert).toHaveBeenCalledWith({
            where: { userId_roleId: { userId: 1, roleId: 'owner-role-id' } },
            create: { userId: 1, roleId: 'owner-role-id' },
            update: {},
        });
        expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('rejects assigning roles to unknown users', async () => {
        userFindUnique.mockResolvedValue(null);
        await expect(service.assignRole(1, 'owner-role-id')).rejects.toThrow(NotFoundException);
        expect(membershipUpsert).not.toHaveBeenCalled();
    });

    it('rejects assigning unknown roles', async () => {
        roleFindUnique.mockResolvedValue(null);
        await expect(service.assignRole(1, 'missing')).rejects.toThrow(NotFoundException);
        expect(membershipUpsert).not.toHaveBeenCalled();
    });

    it('prevents revoking the last Owner', async () => {
        membershipCount.mockResolvedValue(1);
        await expect(service.revokeRole(1, 'owner-role-id')).rejects.toThrow(BadRequestException);
        expect(membershipDelete).not.toHaveBeenCalled();
        expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('allows revoking an Owner when another Owner exists', async () => {
        membershipCount.mockResolvedValue(2);
        membershipDelete.mockResolvedValue({ userId: 1, roleId: 'owner-role-id' });
        await expect(service.revokeRole(1, 'owner-role-id')).resolves.toBeUndefined();
        expect(membershipDelete).toHaveBeenCalledWith({
            where: { userId_roleId: { userId: 1, roleId: 'owner-role-id' } },
        });
    });

    it('rejects invalid user IDs before starting a transaction', async () => {
        await expect(service.revokeRole(0, 'owner-role-id')).rejects.toThrow(BadRequestException);
        expect(transaction).not.toHaveBeenCalled();
    });

    it('allows revoking a non-Owner role', async () => {
        roleFindUnique.mockResolvedValue({ id: 'support-role-id', name: 'Support' });
        await service.revokeRole(1, 'support-role-id');
        expect(membershipCount).not.toHaveBeenCalled();
        expect(membershipDelete).toHaveBeenCalledTimes(1);
    });
});

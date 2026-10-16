import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RbacService } from './rbac.service';

describe('RbacService', () => {
    const queryRaw = jest.fn();
    const roleFindUnique = jest.fn();
    const membershipFindUnique = jest.fn();
    const membershipCount = jest.fn();
    const membershipDelete = jest.fn();

    const tx = {
        $queryRaw: queryRaw,
        role: { findUnique: roleFindUnique },
        userRole: {
            findUnique: membershipFindUnique,
            count: membershipCount,
            delete: membershipDelete,
        },
    };

    const transaction = jest.fn(async (callback) => callback(tx));

    const service = new RbacService({
        $transaction: transaction,
    } as unknown as PrismaService);

    beforeEach(() => {
        jest.resetAllMocks();

        // Restore the transaction callback after resetting mocks.
        transaction.mockImplementation(async (callback) => callback(tx));

        roleFindUnique.mockResolvedValue({
            id: 'owner-role-id',
            name: 'Owner',
        });

        membershipFindUnique.mockResolvedValue({
            userId: 1,
            roleId: 'owner-role-id',
        });

        queryRaw.mockResolvedValue([]);
    });

    it('prevents revoking the last Owner', async () => {
        membershipCount.mockResolvedValue(1);

        await expect(
            service.revokeRole(1, 'owner-role-id'),
        ).rejects.toThrow(BadRequestException);

        expect(membershipDelete).not.toHaveBeenCalled();
        expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('allows revoking an Owner when another Owner exists', async () => {
        membershipCount.mockResolvedValue(2);
        membershipDelete.mockResolvedValue({
            userId: 1,
            roleId: 'owner-role-id',
        });

        await expect(
            service.revokeRole(1, 'owner-role-id'),
        ).resolves.toBeUndefined();

        expect(membershipDelete).toHaveBeenCalledWith({
            where: {
                userId_roleId: {
                    userId: 1,
                    roleId: 'owner-role-id',
                },
            },
        });
    });

    it('rejects invalid user IDs before starting a transaction', async () => {
        await expect(
            service.revokeRole(0, 'owner-role-id'),
        ).rejects.toThrow(BadRequestException);

        expect(transaction).not.toHaveBeenCalled();
    });

    it('allows revoking a non-Owner role', async () => {
        roleFindUnique.mockResolvedValue({
            id: 'support-role-id',
            name: 'Support',
        });

        await service.revokeRole(1, 'support-role-id');

        expect(membershipCount).not.toHaveBeenCalled();
        expect(membershipDelete).toHaveBeenCalledTimes(1);
    });
});
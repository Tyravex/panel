import { BadRequestException } from '@nestjs/common';
import { AdminAuditService } from './admin-audit.service';

describe('AdminAuditService read API', () => {
    const count = jest.fn();
    const findMany = jest.fn();
    const transaction = jest.fn();
    const prisma = {
        adminAuditLog: { count, findMany },
        $transaction: transaction,
    };
    const service = new AdminAuditService(prisma as never);

    beforeEach(() => {
        jest.resetAllMocks();
        count.mockResolvedValue(23);
        findMany.mockResolvedValue([{
            id: 'log-1', actorId: 7, actor: { id: 7, username: 'staff' },
            action: 'ROLE_UPDATED', targetType: 'ROLE', targetId: 'r1',
            metadata: { name: 'Support' }, createdAt: new Date('2026-10-18T10:00:00Z'),
        }]);
        transaction.mockImplementation(async (queries: Promise<unknown>[]) => Promise.all(queries));
    });

    it('returns paginated records with stable descending ordering', async () => {
        const result = await service.list('2', 'ROLE_UPDATED', '7');
        expect(result).toMatchObject({ total: 23, page: 2, limit: 20, pages: 2 });
        expect(result.items).toHaveLength(1);
        expect(count).toHaveBeenCalledWith({ where: { action: 'ROLE_UPDATED', actorId: 7 } });
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { action: 'ROLE_UPDATED', actorId: 7 },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: 20, take: 20,
        }));
        const options = findMany.mock.calls[0][0];
        expect(options.select).toEqual({
            id: true, actorId: true,
            actor: { select: { id: true, username: true } },
            action: true, targetType: true, targetId: true,
            metadata: true, createdAt: true,
        });
        expect(options.select).not.toHaveProperty('password');
        expect(options.select).not.toHaveProperty('sessions');
    });

    it('uses safe defaults when filters are omitted', async () => {
        await service.list();
        expect(count).toHaveBeenCalledWith({ where: {} });
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {}, skip: 0, take: 20 }));
    });

    it.each(['0', '-1', '1.5', 'abc', '100001', 'Infinity'])(
        'rejects invalid page %s', async (page) => {
            await expect(service.list(page)).rejects.toBeInstanceOf(BadRequestException);
            expect(transaction).not.toHaveBeenCalled();
        },
    );

    it.each(['role_updated', 'ROLE-UPDATED', 'X', 'A'.repeat(65)])(
        'rejects invalid action %s', async (action) => {
            await expect(service.list('1', action)).rejects.toBeInstanceOf(BadRequestException);
            expect(transaction).not.toHaveBeenCalled();
        },
    );

    it.each(['0', '-1', '1.5', 'abc', 'Infinity'])(
        'rejects invalid actorId %s', async (actorId) => {
            await expect(service.list('1', undefined, actorId)).rejects.toBeInstanceOf(BadRequestException);
            expect(transaction).not.toHaveBeenCalled();
        },
    );

    it('propagates database failures', async () => {
        count.mockRejectedValue(new Error('Database unavailable'));
        await expect(service.list()).rejects.toThrow('Database unavailable');
    });
});

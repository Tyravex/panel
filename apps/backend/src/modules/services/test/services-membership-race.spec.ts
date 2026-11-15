import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ServicesService } from '../services.service';

describe('ServicesService membership ownership concurrency', () => {
    const events: string[] = [];

    const queryRaw = jest.fn();
    const serviceFindUnique = jest.fn();
    const serviceUpdate = jest.fn();
    const userFindFirst = jest.fn();
    const memberFindUnique = jest.fn();
    const memberCreate = jest.fn();
    const memberUpdate = jest.fn();
    const memberDeleteMany = jest.fn();
    const auditCreate = jest.fn();
    const transaction = jest.fn();

    let service: ServicesService;

    beforeEach(() => {
        jest.resetAllMocks();
        events.length = 0;

        queryRaw.mockImplementation(async () => {
            events.push('lock');
            return [{ id: 'svc-1' }];
        });

        serviceUpdate.mockResolvedValue({
            id: 'svc-1',
            userId: null,
        });

        memberCreate.mockImplementation(async () => {
            events.push('create');
            return { userId: 8 };
        });

        memberUpdate.mockImplementation(async () => {
            events.push('update');
            return {
                userId: 8,
                permissions: ['service:view'],
            };
        });

        memberDeleteMany.mockImplementation(async () => {
            events.push('delete');
            return { count: 1 };
        });

        transaction.mockImplementation(async (callback) =>
            callback({
                $queryRaw: queryRaw,
                service: {
                    findUnique: serviceFindUnique,
                    update: serviceUpdate,
                },
                user: {
                    findFirst: userFindFirst,
                },
                serviceMember: {
                    findUnique: memberFindUnique,
                    create: memberCreate,
                    update: memberUpdate,
                    deleteMany: memberDeleteMany,
                },
                adminAuditLog: {
                    create: auditCreate,
                },
            }),
        );

        service = new ServicesService({
            $transaction: transaction,
        } as unknown as PrismaService);
    });

    it('locks ownership before adding a member', async () => {
        userFindFirst.mockResolvedValue({ id: 8 });
        memberFindUnique.mockResolvedValue(null);

        await service.addMember('svc-1', 7, {
            userId: 8,
            permissions: ['service:view'],
        });

        expect(transaction).toHaveBeenCalledTimes(1);
        expect(events).toEqual(['lock', 'create']);
        expect(queryRaw).toHaveBeenCalledTimes(1);
        expect(memberCreate).toHaveBeenCalledTimes(1);
    });

    it('locks ownership before updating a member', async () => {
        memberFindUnique.mockResolvedValue({
            id: 'member-1',
        });

        await service.updateMember('svc-1', 7, 8, {
            permissions: ['service:view'],
        });

        expect(transaction).toHaveBeenCalledTimes(1);
        expect(events).toEqual(['lock', 'update']);
        expect(memberUpdate).toHaveBeenCalledTimes(1);
    });

    it('locks ownership before removing a member', async () => {
        await service.removeMember('svc-1', 7, 8);

        expect(transaction).toHaveBeenCalledTimes(1);
        expect(events).toEqual(['lock', 'delete']);
        expect(memberDeleteMany).toHaveBeenCalledTimes(1);
    });

    it.each(['add', 'update', 'remove'] as const)(
        'rejects %s after ownership has changed',
        async (operation) => {
            queryRaw.mockResolvedValue([]);

            const action =
                operation === 'add'
                    ? service.addMember('svc-1', 7, {
                        userId: 8,
                        permissions: ['service:view'],
                    })
                    : operation === 'update'
                        ? service.updateMember('svc-1', 7, 8, {
                            permissions: ['service:view'],
                        })
                        : service.removeMember('svc-1', 7, 8);

            await expect(action).rejects.toThrow(
                NotFoundException,
            );

            expect(transaction).toHaveBeenCalledTimes(1);
            expect(memberCreate).not.toHaveBeenCalled();
            expect(memberUpdate).not.toHaveBeenCalled();
            expect(memberDeleteMany).not.toHaveBeenCalled();
        },
    );

    it('locks service before reading current owner for transfer', async () => {
        serviceFindUnique.mockImplementation(async () => {
            events.push('read-owner');
            return {
                id: 'svc-1',
                userId: 7,
            };
        });

        serviceUpdate.mockResolvedValue({
            id: 'svc-1',
            userId: null,
        });

        auditCreate.mockResolvedValue({
            id: 'audit-1',
        });

        const result = await service.setOwner(
            'svc-1',
            7,
            { userId: null },
        );

        expect(result).toEqual({
            id: 'svc-1',
            userId: null,
        });

        expect(events[0]).toBe('lock');
        expect(events[1]).toBe('read-owner');
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(serviceUpdate).toHaveBeenCalledTimes(1);
        expect(auditCreate).toHaveBeenCalledTimes(1);
    });

    it('rejects transfer when the service does not exist', async () => {
        queryRaw.mockResolvedValue([]);

        await expect(
            service.setOwner(
                'missing',
                7,
                { userId: null },
            ),
        ).rejects.toThrow(NotFoundException);

        expect(serviceFindUnique).not.toHaveBeenCalled();
        expect(serviceUpdate).not.toHaveBeenCalled();
        expect(auditCreate).not.toHaveBeenCalled();
    });
});
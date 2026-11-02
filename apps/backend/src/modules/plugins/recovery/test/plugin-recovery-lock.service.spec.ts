import { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';

import { PluginRecoveryLockService } from '../plugin-recovery-lock.service';

describe('PluginRecoveryLockService', () => {
    const queryRaw = jest.fn();
    const transaction = jest.fn();

    const tx = {
        $queryRaw: queryRaw,
    } as unknown as Prisma.TransactionClient;

    const prisma = {
        $transaction: transaction,
    } as unknown as PrismaService;

    const service = new PluginRecoveryLockService(prisma);

    beforeEach(() => {
        jest.resetAllMocks();

        transaction.mockImplementation(
            async (
                callback: (client: Prisma.TransactionClient) => Promise<unknown>,
            ) => callback(tx),
        );

        queryRaw.mockResolvedValue([{ acquired: true }]);
    });

    it('executes the operation when the lock is acquired', async () => {
        const operation = jest.fn().mockResolvedValue('completed');

        const result = await service.withLock(operation);

        expect(result).toEqual({
            acquired: true,
            result: 'completed',
        });

        expect(operation).toHaveBeenCalledTimes(1);
        expect(operation).toHaveBeenCalledWith(tx);
        expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('does not execute the operation when the lock is unavailable', async () => {
        queryRaw.mockResolvedValue([{ acquired: false }]);

        const operation = jest.fn();

        const result = await service.withLock(operation);

        expect(result).toEqual({
            acquired: false,
        });

        expect(operation).not.toHaveBeenCalled();
    });

    it('fails closed when PostgreSQL returns no lock result', async () => {
        queryRaw.mockResolvedValue([]);

        const operation = jest.fn();

        const result = await service.withLock(operation);

        expect(result).toEqual({
            acquired: false,
        });

        expect(operation).not.toHaveBeenCalled();
    });

    it('propagates an error from the protected operation', async () => {
        const error = new Error('Recovery failed');

        const operation = jest.fn().mockRejectedValue(error);

        await expect(
            service.withLock(operation),
        ).rejects.toThrow('Recovery failed');

        expect(operation).toHaveBeenCalledTimes(1);
    });

    it('propagates a PostgreSQL query failure', async () => {
        queryRaw.mockRejectedValue(
            new Error('Database unavailable'),
        );

        const operation = jest.fn();

        await expect(
            service.withLock(operation),
        ).rejects.toThrow('Database unavailable');

        expect(operation).not.toHaveBeenCalled();
    });

    it('uses an interactive transaction with bounded timeouts', async () => {
        const operation = jest.fn().mockResolvedValue(undefined);

        await service.withLock(operation);

        expect(transaction).toHaveBeenCalledWith(
            expect.any(Function),
            {
                maxWait: 5000,
                timeout: 10000,
                isolationLevel:
                    Prisma.TransactionIsolationLevel.ReadCommitted,
            },
        );
    });

    it('requests a transactional advisory lock', async () => {
        const operation = jest.fn().mockResolvedValue(undefined);

        await service.withLock(operation);

        expect(queryRaw).toHaveBeenCalledTimes(1);

        const [template, ...values] = queryRaw.mock.calls[0] as [
            TemplateStringsArray,
            ...unknown[],
        ];

        expect(template.join('?')).toContain(
            'pg_try_advisory_xact_lock',
        );

        expect(values).toEqual([742010001]);
    });
});
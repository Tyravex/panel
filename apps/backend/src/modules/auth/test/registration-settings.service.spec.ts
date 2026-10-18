import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RegistrationSettingsService } from '../registration-settings.service';

describe('RegistrationSettingsService - Prisma model', () => {
    const findUnique = jest.fn();
    const upsert = jest.fn();
    const queryRaw = jest.fn();
    const auditCreate = jest.fn();
    const transaction = jest.fn();
    let service: RegistrationSettingsService;

    beforeEach(() => {
        jest.resetAllMocks();
        queryRaw.mockResolvedValue([{ pg_advisory_xact_lock: '' }]);
        transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
            fn({
                $queryRaw: queryRaw,
                panelSetting: { findUnique, upsert },
                adminAuditLog: { create: auditCreate },
            }),
        );
        service = new RegistrationSettingsService({
            panelSetting: { findUnique, upsert },
            $transaction: transaction,
        } as unknown as PrismaService);
    });

    it('defaults to disabled when the Prisma setting does not exist', async () => {
        findUnique.mockResolvedValue(null);
        await expect(service.isRegistrationEnabled()).resolves.toBe(false);
        expect(findUnique).toHaveBeenCalledWith({
            where: { key: 'registrationEnabled' },
            select: { booleanValue: true },
        });
    });

    it.each([true, false])('reads the persisted boolean %p', async (enabled) => {
        findUnique.mockResolvedValue({ booleanValue: enabled });
        await expect(service.isRegistrationEnabled()).resolves.toBe(enabled);
    });

    it('propagates database read failures (fail closed)', async () => {
        findUnique.mockRejectedValue(new Error('Database unavailable'));
        await expect(service.isRegistrationEnabled()).rejects.toThrow('Database unavailable');
    });

    it.each([undefined, null, 'true', 1, {}, []])(
        'rejects invalid setting value %p',
        async (value) => {
            await expect(service.setRegistrationEnabled(value, 1)).rejects.toThrow(BadRequestException);
            expect(transaction).not.toHaveBeenCalled();
        },
    );

    it.each([0, -1, 1.5, Number.NaN])('rejects invalid actor %p', async (actorId) => {
        await expect(service.setRegistrationEnabled(true, actorId)).rejects.toThrow(BadRequestException);
        expect(transaction).not.toHaveBeenCalled();
    });

    it('enables registration and writes the audit record in the same transaction', async () => {
        findUnique.mockResolvedValue({ booleanValue: false });
        upsert.mockResolvedValue({ key: 'registrationEnabled', booleanValue: true });
        auditCreate.mockResolvedValue({ id: 'audit-1' });

        await expect(service.setRegistrationEnabled(true, 7)).resolves.toEqual({ registrationEnabled: true });
        expect(queryRaw).toHaveBeenCalledTimes(1);
        expect(upsert).toHaveBeenCalledWith({
            where: { key: 'registrationEnabled' },
            create: { key: 'registrationEnabled', booleanValue: true },
            update: { booleanValue: true },
        });
        expect(auditCreate).toHaveBeenCalledWith({
            data: {
                actorId: 7,
                action: 'REGISTRATION_SETTING_CHANGED',
                targetType: 'PANEL_SETTING',
                targetId: 'registrationEnabled',
                metadata: { previous: false, enabled: true },
            }
        });
    });

    it('does not update or audit an unchanged setting', async () => {
        findUnique.mockResolvedValue({ booleanValue: true });
        await expect(service.setRegistrationEnabled(true, 7)).resolves.toEqual({ registrationEnabled: true });
        expect(upsert).not.toHaveBeenCalled();
        expect(auditCreate).not.toHaveBeenCalled();
    });

    it('creates a missing setting when explicitly enabled', async () => {
        findUnique.mockResolvedValue(null);
        await expect(service.setRegistrationEnabled(true, 7)).resolves.toEqual({ registrationEnabled: true });
        expect(upsert).toHaveBeenCalledTimes(1);
        expect(auditCreate).toHaveBeenCalledTimes(1);
    });

    it('propagates audit failures to roll back the transaction', async () => {
        findUnique.mockResolvedValue({ booleanValue: false });
        auditCreate.mockRejectedValue(new Error('Audit failed'));
        await expect(service.setRegistrationEnabled(true, 7)).rejects.toThrow('Audit failed');
        expect(transaction).toHaveBeenCalledTimes(1);
    });
});

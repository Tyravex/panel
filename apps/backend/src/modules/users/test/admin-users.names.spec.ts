import { BadRequestException } from '@nestjs/common';
import { AdminUsersService } from '../admin-users.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AdminUsersService optional names', () => {
    const findUnique = jest.fn();
    const create = jest.fn();
    const update = jest.fn();
    const transaction = jest.fn();

    const prisma = {
        user: { findUnique },
        $transaction: transaction,
    };

    let service: AdminUsersService;

    beforeEach(() => {
        jest.resetAllMocks();

        service = new AdminUsersService(
            prisma as unknown as PrismaService,
        );

        findUnique.mockResolvedValue({ id: 12 });

        create.mockResolvedValue({ id: 12 });
        update.mockResolvedValue({ id: 12 });

        transaction.mockImplementation(
            async (callback: (tx: unknown) => Promise<unknown>) =>
                callback({
                    user: { create, update },
                    adminAuditLog: { create: jest.fn() },
                }),
        );
    });

    it('saves Polish names when creating a user', async () => {
        await service.create({
            username: 'testuser',
            email: 'test@example.invalid',
            password: 'SecurePassword123!',
            firstName: 'Łukasz',
            lastName: 'Żółć-Nowak',
        });

        expect(create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    firstName: 'Łukasz',
                    lastName: 'Żółć-Nowak',
                }),
            }),
        );
    });

    it('updates optional names', async () => {
        await service.update(12, {
            username: 'testuser',
            email: 'test@example.invalid',
            firstName: 'Anna',
            lastName: 'Nowak',
        });

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 12 },
                data: {
                    username: 'testuser',
                    email: 'test@example.invalid',
                    firstName: 'Anna',
                    lastName: 'Nowak',
                },
            }),
        );
    });

    it('allows clearing names during editing', async () => {
        await service.update(12, {
            username: 'testuser',
            email: 'test@example.invalid',
            firstName: null,
            lastName: '',
        });

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    firstName: null,
                    lastName: null,
                }),
            }),
        );
    });

    it('preserves names when editing without supplying them', async () => {
        await service.update(12, {
            username: 'testuser',
            email: 'test@example.invalid',
        });

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    username: 'testuser',
                    email: 'test@example.invalid',
                },
            }),
        );
    });

    it.each([
        ['number', { firstName: 123 }],
        ['whitespace', { firstName: ' Anna' }],
        ['too long', { lastName: 'A'.repeat(81) }],
        ['invalid characters', { firstName: '<script>' }],
        ['array', { lastName: ['Nowak'] }],
    ])('rejects invalid names during editing: %s', async (_label, names) => {
        await expect(
            service.update(12, {
                username: 'testuser',
                email: 'test@example.invalid',
                ...names,
            } as Parameters<AdminUsersService['update']>[1]),
        ).rejects.toThrow(BadRequestException);

        expect(update).not.toHaveBeenCalled();
        expect(transaction).not.toHaveBeenCalled();
    });
});
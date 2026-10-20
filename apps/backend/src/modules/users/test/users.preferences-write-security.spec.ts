import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersService } from '../users.service';

describe('UsersService preference write boundaries', () => {
    const update = jest.fn();
    const findFirst = jest.fn();

    const service = new UsersService({
        user: { update },
        language: { findFirst },
    } as unknown as PrismaService);

    beforeEach(() => {
        jest.resetAllMocks();

        findFirst.mockImplementation(
            async ({ where }: { where: { code: string } }) => ({
                code: where.code,
            }),
        );

        update.mockResolvedValue({
            id: 12,
            username: 'test-user',
            email: 'test@example.invalid',
            language: 'en',
            avatar: null,
        });
    });

    it.each([
        ['extra user ID', { language: 'en', userId: 999 }],
        ['privileged fields', {
            language: 'pl',
            isActive: false,
            roles: ['Owner'],
        }],
        ['credential fields', {
            language: 'en',
            password: 'attacker-value',
        }],
        ['unknown field', {
            language: 'en',
            arbitrary: { nested: true },
        }],
    ])(
        'rejects preferences containing %s',
        async (_label, body) => {
            await expect(
                service.updatePreferences(12, body),
            ).rejects.toThrow(BadRequestException);

            expect(findFirst).not.toHaveBeenCalled();
            expect(update).not.toHaveBeenCalled();
        },
    );

    it('does not substitute a user ID from the input body', async () => {
        await expect(
            service.updatePreferences(12, {
                language: 'en',
                userId: 999,
            }),
        ).rejects.toThrow(BadRequestException);

        expect(update).not.toHaveBeenCalled();
    });

    it('rejects missing language without writing other fields', async () => {
        await expect(
            service.updatePreferences(12, {
                isActive: false,
                userId: 999,
            }),
        ).rejects.toThrow(BadRequestException);

        expect(update).not.toHaveBeenCalled();
    });

    it('rejects malformed language codes', async () => {
        await expect(
            service.updatePreferences(12, {
                language: '../secret',
            }),
        ).rejects.toThrow(BadRequestException);

        expect(findFirst).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('rejects disabled or unregistered languages', async () => {
        findFirst.mockResolvedValue(null);

        await expect(
            service.updatePreferences(12, {
                language: 'en',
            }),
        ).rejects.toThrow(BadRequestException);

        expect(update).not.toHaveBeenCalled();
    });

    it('writes only language for a valid request', async () => {
        await service.updatePreferences(12, {
            language: 'en',
        });

        expect(findFirst).toHaveBeenCalledWith({
            where: {
                code: 'en',
                isEnabled: true,
            },
            select: {
                code: true,
            },
        });

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 12 },
                data: { language: 'en' },
            }),
        );

        expect(update).toHaveBeenCalledTimes(1);
    });

    it('selects only safe public profile fields', async () => {
        await service.updatePreferences(12, {
            language: 'en',
        });

        const selection = update.mock.calls[0][0].select;

        expect(selection).toEqual({
            id: true,
            username: true,
            email: true,
            language: true,
            avatar: true,
            createdAt: true,
            updatedAt: true,
        });

        expect(selection).not.toHaveProperty('password');
        expect(selection).not.toHaveProperty('sessions');
        expect(selection).not.toHaveProperty('roles');
    });
});

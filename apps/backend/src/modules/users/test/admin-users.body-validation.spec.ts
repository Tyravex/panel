import { BadRequestException } from '@nestjs/common';
import { AdminUsersService } from '../admin-users.service';

describe('AdminUsersService body validation boundaries', () => {
    const prisma = {
        user: { findUnique: jest.fn() },
        $transaction: jest.fn(),
    };
    const service = new AdminUsersService(prisma as never);

    beforeEach(() => jest.clearAllMocks());

    describe('create', () => {
        it.each([
            ['missing body', undefined],
            ['empty body', {}],
            ['missing username', { email: 'valid@example.invalid', password: 'password12345' }],
            ['non-string username', { username: 42, email: 'valid@example.invalid', password: 'password12345' }],
            ['short username', { username: 'ab', email: 'valid@example.invalid', password: 'password12345' }],
            ['invalid username characters', { username: 'invalid name', email: 'valid@example.invalid', password: 'password12345' }],
            ['missing email', { username: 'valid_user', password: 'password12345' }],
            ['invalid email', { username: 'valid_user', email: 'invalid', password: 'password12345' }],
            ['non-string email', { username: 'valid_user', email: 123, password: 'password12345' }],
            ['missing password', { username: 'valid_user', email: 'valid@example.invalid' }],
            ['short password', { username: 'valid_user', email: 'valid@example.invalid', password: 'short' }],
            ['long password', { username: 'valid_user', email: 'valid@example.invalid', password: 'x'.repeat(129) }],
            ['non-string password', { username: 'valid_user', email: 'valid@example.invalid', password: 123456789012 }],
        ])('rejects %s before starting a transaction', async (_label, body) => {
            await expect(service.create(body as never, 7)).rejects.toBeInstanceOf(BadRequestException);
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it.each([
            ['missing body', undefined],
            ['missing username', { email: 'valid@example.invalid' }],
            ['missing email', { username: 'valid_user' }],
            ['invalid username', { username: 'bad name', email: 'valid@example.invalid' }],
            ['invalid email', { username: 'valid_user', email: 'not-an-email' }],
            ['non-string username', { username: [], email: 'valid@example.invalid' }],
        ])('rejects %s before database access', async (_label, body) => {
            await expect(service.update(9, body as never, 7)).rejects.toBeInstanceOf(BadRequestException);
            expect(prisma.user.findUnique).not.toHaveBeenCalled();
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });
    });

    describe('setActive', () => {
        it.each([undefined, null, 'false', 0, 1, {}, []])(
            'rejects non-boolean status %p before database access',
            async (status) => {
                await expect(service.setActive(9, status, 7)).rejects.toBeInstanceOf(BadRequestException);
                expect(prisma.$transaction).not.toHaveBeenCalled();
            },
        );

        it('rejects self-deactivation before database access', async () => {
            await expect(service.setActive(7, false, 7)).rejects.toBeInstanceOf(BadRequestException);
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });
    });
});

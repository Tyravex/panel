import { PrismaService } from '../../../prisma/prisma.service';
import { UsersService } from '../users.service';

describe('UsersService preference write boundaries', () => {
    const update = jest.fn();
    const service = new UsersService({
        user: { update },
    } as unknown as PrismaService);

    beforeEach(() => {
        jest.resetAllMocks();
        update.mockResolvedValue({
            id: 12, username: 'test-user', email: 'test@example.invalid',
            language: 'en', avatar: null,
        });
    });

    it.each([
        ['extra user ID', { language: 'en', userId: 999 }],
        ['privileged fields', { language: 'pl', isActive: false, roles: ['Owner'] }],
        ['credential fields', { language: 'en', password: 'attacker-value' }],
        ['unknown field', { language: 'en', arbitrary: { nested: true } }],
    ])('writes only language when input contains %s', async (_label, body) => {
        await service.updatePreferences(12, body as never);

        expect(update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 12 },
            data: { language: body.language },
        }));
        expect(update).toHaveBeenCalledTimes(1);
    });

    it('does not substitute a user ID from the input body', async () => {
        await service.updatePreferences(12, { language: 'en', userId: 999 } as never);
        expect(update.mock.calls[0][0].where).toEqual({ id: 12 });
    });

    it('does not pass missing language through as other writable fields', async () => {
        await service.updatePreferences(12, { isActive: false, userId: 999 } as never);
        expect(update.mock.calls[0][0].data).toEqual({ language: undefined });
    });

    it('selects only safe public profile fields', async () => {
        await service.updatePreferences(12, { language: 'en' });
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

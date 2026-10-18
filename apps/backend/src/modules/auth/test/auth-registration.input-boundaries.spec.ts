import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { AuthService } from '../auth.service';
import { RegistrationSettingsService } from '../registration-settings.service';

describe('AuthService registration input boundary characterization', () => {
    const create = jest.fn();
    const isRegistrationEnabled = jest.fn();
    let service: AuthService;

    beforeEach(() => {
        jest.resetAllMocks();
        isRegistrationEnabled.mockResolvedValue(true);
        create.mockResolvedValue({
            id: 27,
            username: 'new-user',
            email: 'new-user@example.invalid',
            password: 'stored-hash',
            roles: [],
        });
        service = new AuthService(
            { user: { create } } as unknown as PrismaService,
            {} as JwtService,
            {} as NotificationsGateway,
            { isRegistrationEnabled } as unknown as RegistrationSettingsService,
        );
    });

    it.each([
        ['blank username', '', 'new-user@example.invalid', 'secret-password-123'],
        ['blank email', 'new-user', '', 'secret-password-123'],
        ['short password', 'new-user', 'new-user@example.invalid', 'short'],
        ['malformed email', 'new-user', 'not-an-email', 'secret-password-123'],
    ])('currently forwards %s to persistence without business validation', async (_label, username, email, password) => {
        await service.register(username, email, password);

        expect(create).toHaveBeenCalledTimes(1);
        expect(create).toHaveBeenCalledWith({
            data: {
                username,
                email,
                password: expect.any(String),
            },
        });
    });

    it('does not normalize or trim username and email before persistence', async () => {
        await service.register(' new-user ', ' NEW-USER@example.invalid ', 'secret-password-123');

        expect(create).toHaveBeenCalledWith({
            data: {
                username: ' new-user ',
                email: ' NEW-USER@example.invalid ',
                password: expect.any(String),
            },
        });
    });

    it('rejects a non-string password before reaching persistence', async () => {
        await expect(service.register('new-user', 'new-user@example.invalid', undefined as unknown as string))
            .rejects.toThrow();
        expect(create).not.toHaveBeenCalled();
    });
});

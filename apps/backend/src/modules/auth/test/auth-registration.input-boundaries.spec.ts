import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { AuthService } from '../auth.service';
import { RegistrationSettingsService } from '../registration-settings.service';

describe('AuthService registration input boundaries', () => {
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
        ['invalid username', 'new.user', 'new-user@example.invalid', 'secret-password-123'],
    ])('rejects %s before persistence', async (_label, username, email, password) => {
        await expect(service.register(username, email, password)).rejects.toThrow(BadRequestException);
        expect(create).not.toHaveBeenCalled();
    });

    it('rejects untrimmed username and email rather than silently normalizing them', async () => {
        await expect(service.register(' new-user ', ' NEW-USER@example.invalid ', 'secret-password-123'))
            .rejects.toThrow(BadRequestException);
        expect(create).not.toHaveBeenCalled();
    });

    it('rejects a non-string password before reaching persistence', async () => {
        await expect(service.register('new-user', 'new-user@example.invalid', undefined as unknown as string))
            .rejects.toThrow(BadRequestException);
        expect(create).not.toHaveBeenCalled();
    });

    it('persists valid values without normalization', async () => {
        await service.register('new-user', 'new-user@example.invalid', 'secret-password-123');
        expect(create).toHaveBeenCalledWith({
            data: {
                username: 'new-user',
                email: 'new-user@example.invalid',
                password: expect.any(String),
            },
        });
    });
});

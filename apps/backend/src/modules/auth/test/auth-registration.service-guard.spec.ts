import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { AuthService } from '../auth.service';
import { RegistrationSettingsService } from '../registration-settings.service';

describe('AuthService registration setting enforcement', () => {
    const create = jest.fn();
    const isRegistrationEnabled = jest.fn();
    const register = (service: AuthService) =>
        service.register('new-user', 'new-user@example.invalid', 'secret-password-123');

    const makeService = (settings?: RegistrationSettingsService) => new AuthService(
        { user: { create } } as unknown as PrismaService,
        {} as JwtService,
        {} as NotificationsGateway,
        settings,
    );

    beforeEach(() => {
        jest.resetAllMocks();
        create.mockResolvedValue({ id: 27, username: 'new-user', email: 'new-user@example.invalid', roles: [] });
    });

    it('denies registration when the persisted setting is disabled', async () => {
        isRegistrationEnabled.mockResolvedValue(false);
        await expect(register(makeService({ isRegistrationEnabled } as unknown as RegistrationSettingsService)))
            .rejects.toThrow(ForbiddenException);
        expect(create).not.toHaveBeenCalled();
    });

    it('denies registration if the settings dependency is missing', async () => {
        await expect(register(makeService())).rejects.toThrow(ForbiddenException);
        expect(create).not.toHaveBeenCalled();
    });

    it('does not create users if reading the setting fails', async () => {
        isRegistrationEnabled.mockRejectedValue(new Error('Database unavailable'));
        await expect(register(makeService({ isRegistrationEnabled } as unknown as RegistrationSettingsService)))
            .rejects.toThrow('Database unavailable');
        expect(create).not.toHaveBeenCalled();
    });

    it('creates a user only after the stored setting is enabled', async () => {
        isRegistrationEnabled.mockResolvedValue(true);
        await expect(register(makeService({ isRegistrationEnabled } as unknown as RegistrationSettingsService)))
            .resolves.toMatchObject({ id: 27, username: 'new-user' });
        expect(isRegistrationEnabled).toHaveBeenCalledTimes(1);
        expect(create).toHaveBeenCalledTimes(1);
    });
});

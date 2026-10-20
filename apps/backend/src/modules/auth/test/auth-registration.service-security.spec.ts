import * as bcrypt from 'bcryptjs';
import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { AuthService } from '../auth.service';
import { RegistrationSettingsService } from '../registration-settings.service';

describe('AuthService registration persistence security', () => {
    const create = jest.fn();
    const isRegistrationEnabled = jest.fn();
    let service: AuthService;

    const storedUser = () => ({
        id: 27,
        username: 'new-user',
        email: 'new-user@example.invalid',
        password: 'stored-password-hash',
        isActive: true,
        language: 'en',
        avatar: null,
        roles: [],
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    beforeEach(() => {
        jest.resetAllMocks();
        create.mockResolvedValue(storedUser());
        isRegistrationEnabled.mockResolvedValue(true);
        service = new AuthService(
            { user: { create } } as unknown as PrismaService,
            {} as JwtService,
            {} as NotificationsGateway,
            { isRegistrationEnabled } as unknown as RegistrationSettingsService,
        );
    });

    it('hashes the password before inserting a new user', async () => {
        await service.register('new-user', 'new-user@example.invalid', 'secret-password-123');

        expect(create).toHaveBeenCalledTimes(1);
        const input = create.mock.calls[0][0];
        expect(input.data.username).toBe('new-user');
        expect(input.data.email).toBe('new-user@example.invalid');
        expect(input.data.password).not.toBe('secret-password-123');
        expect(input.data.password).toMatch(/^\$2[aby]\$10\$/);
        await expect(bcrypt.compare('secret-password-123', input.data.password)).resolves.toBe(true);
    });

    it('does not assign privileged roles or administrative flags during registration', async () => {
        await service.register('new-user', 'new-user@example.invalid', 'secret-password-123');

        expect(Object.keys(create.mock.calls[0][0].data).sort()).toEqual([
            'email', 'password', 'username',
        ]);
    });

    it('returns a public profile without a password or credential hash', async () => {
        const result = await service.register('new-user', 'new-user@example.invalid', 'secret-password-123');

        expect(result).toMatchObject({
            id: 27,
            username: 'new-user',
            email: 'new-user@example.invalid',
            language: 'en',
            roles: [],
            permissions: [],
        });
        expect(result).not.toHaveProperty('password');
        expect(result).not.toHaveProperty('isActive');
        expect(result).not.toHaveProperty('sessions');
    });

    it('does not issue JWTs or sessions as a side effect of registration', async () => {
        await service.register('new-user', 'new-user@example.invalid', 'secret-password-123');
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('propagates a database failure instead of returning a successful registration', async () => {
        create.mockRejectedValue(new Error('Database unavailable'));

        await expect(service.register('new-user', 'new-user@example.invalid', 'secret-password-123'))
            .rejects.toThrow('Database unavailable');
        expect(create).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['username', 'Ta nazwa użytkownika jest już zajęta. Wybierz inną.'],
        ['email', 'Ten adres e-mail jest już używany.'],
    ])('maps duplicate %s to a specific conflict message', async (field, message) => {
        create.mockRejectedValue(Object.assign(new Error('Sensitive database detail'), {
            code: 'P2002', meta: { target: [field] },
        }));

        await expect(service.register('new-user', 'new-user@example.invalid', 'secret-password-123'))
            .rejects.toThrow(new ConflictException(message));
        expect(create).toHaveBeenCalledTimes(1);
    });

    it.each([
        undefined,
        { target: ['other_field'] },
        { target: ['username', 'email'] },
        { target: 'users_email_key' },
    ])('uses a generic message for unknown unique constraints (%p)', async (meta) => {
        create.mockRejectedValue({ code: 'P2002', meta, message: 'Sensitive database detail' });

        await expect(service.register('new-user', 'new-user@example.invalid', 'secret-password-123'))
            .rejects.toThrow(new ConflictException('Nie można utworzyć konta z podanymi danymi.'));
        expect(create).toHaveBeenCalledTimes(1);
    });


    it('persists optional names without assigning extra privileges', async () => {
        await service.register(
            'new-user',
            'new-user@example.invalid',
            'secret-password-123',
            'Anna',
            'Kowalska',
        );

        expect(create).toHaveBeenCalledWith({
            data: {
                username: 'new-user',
                email: 'new-user@example.invalid',
                password: expect.any(String),
                firstName: 'Anna',
                lastName: 'Kowalska',
            },
        });

        expect(create.mock.calls[0][0].data).not.toHaveProperty('isAdmin');
        expect(create.mock.calls[0][0].data).not.toHaveProperty('roles');
    });

});

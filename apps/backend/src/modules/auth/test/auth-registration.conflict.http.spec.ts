import { ConflictException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RegistrationSettingsService } from '../registration-settings.service';

describe('Registration unique conflict and HTTP sanitization', () => {
    const create = jest.fn();
    const isRegistrationEnabled = jest.fn();
    let service: AuthService;
    let app: INestApplication;

    const input = {
        username: 'new-user',
        email: 'new-user@example.invalid',
        password: 'secret-password-123',
    };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                AuthService,
                { provide: PrismaService, useValue: { user: { create } } },
                { provide: JwtService, useValue: {} },
                { provide: NotificationsGateway, useValue: {} },
                { provide: RegistrationSettingsService, useValue: { isRegistrationEnabled } },
            ],
        }).compile();
        app = moduleRef.createNestApplication({ logger: false });
        await app.init();
        service = app.get(AuthService);
    });

    afterAll(async () => { await app?.close(); });

    beforeEach(() => {
        jest.resetAllMocks();
        isRegistrationEnabled.mockResolvedValue(true);
    });

    it.each([
        ['username', 'Ta nazwa użytkownika jest już zajęta. Wybierz inną.'],
        ['email', 'Ten adres e-mail jest już używany.'],
    ])('returns a specific 409 for duplicate %s', async (field, message) => {
        create.mockRejectedValue(Object.assign(new Error('Sensitive database detail'), {
            code: 'P2002', meta: { target: [field], secret: 'database detail' },
        }));
        const response = await request(app.getHttpServer())
            .post('/auth/register').send(input).expect(409);
        expect(response.body).toEqual({ message, error: 'Conflict', statusCode: 409 });
        expect(JSON.stringify(response.body)).not.toContain('database detail');
        expect(JSON.stringify(response.body)).not.toContain('Sensitive database detail');
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('returns a generic 409 for an unrecognized unique constraint', async () => {
        create.mockRejectedValue({ code: 'P2002', meta: { target: ['unknown_field'] } });
        const response = await request(app.getHttpServer())
            .post('/auth/register').send(input).expect(409);
        expect(response.body).toEqual({
            message: 'Nie można utworzyć konta z podanymi danymi.',
            error: 'Conflict',
            statusCode: 409,
        });
    });

    it('does not convert unrelated Prisma failures into conflicts', async () => {
        create.mockRejectedValue(Object.assign(new Error('Database failure'), { code: 'P1001' }));
        const response = await request(app.getHttpServer())
            .post('/auth/register').send(input).expect(500);
        expect(response.body).toEqual({ statusCode: 500, message: 'Internal server error' });
    });

    it('preserves a 403 response when registration is disabled', async () => {
        isRegistrationEnabled.mockResolvedValue(false);
        create.mockRejectedValue(Object.assign(new Error('Duplicate'), { code: 'P2002' }));
        await request(app.getHttpServer()).post('/auth/register').send(input).expect(403);
        expect(create).not.toHaveBeenCalled();
    });

    it('returns a ConflictException for direct service calls', async () => {
        create.mockRejectedValue({ code: 'P2002', meta: { target: ['username'] } });
        await expect(service.register(input.username, input.email, input.password))
            .rejects.toBeInstanceOf(ConflictException);
    });
});

import { ConflictException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RegistrationSettingsService } from '../registration-settings.service';
import { RegistrationRateLimitGuard } from '../guards/registration-rate-limit.guard';

describe('Registration rate limit HTTP boundary', () => {
    let app: INestApplication;
    const register = jest.fn();
    const isRegistrationEnabled = jest.fn();
    const input = { username: 'new-user', email: 'new-user@example.invalid', password: 'secret-password-123' };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                RegistrationRateLimitGuard,
                { provide: AuthService, useValue: { register } },
                { provide: RegistrationSettingsService, useValue: { isRegistrationEnabled } },
            ],
        }).compile();
        app = moduleRef.createNestApplication({ logger: false });
        await app.init();
    });
    afterAll(async () => { await app?.close(); });
    beforeEach(() => {
        jest.resetAllMocks();
        isRegistrationEnabled.mockResolvedValue(true);
        register.mockResolvedValue({ id: 1 });
    });

    it('limits requests regardless of success, validation failure, or conflict', async () => {
        for (let i = 0; i < 20; i++) {
            if (i % 3 === 0) {
                await request(app.getHttpServer()).post('/auth/register').send({}).expect(400);
            } else if (i % 3 === 1) {
                register.mockRejectedValueOnce(new ConflictException('Duplicate'));
                await request(app.getHttpServer()).post('/auth/register').send(input).expect(409);
            } else {
                await request(app.getHttpServer()).post('/auth/register').send(input).expect(201);
            }
        }
        const calls = register.mock.calls.length;
        const result = await request(app.getHttpServer()).post('/auth/register').send(input).expect(429);
        expect(result.headers['retry-after']).toBeDefined();
        expect(result.body.message).toBe('Too many registration attempts. Try again later.');
        expect(register).toHaveBeenCalledTimes(calls);
    });
});

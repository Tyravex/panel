import { ConflictException, INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RegistrationSettingsService } from '../registration-settings.service';
import { RegistrationRateLimitGuard } from '../guards/registration-rate-limit.guard';
import { RegistrationRateLimitStore } from '../registration-rate-limit.store';

describe('Registration rate limit HTTP boundary', () => {
    let app: INestApplication;
    const register = jest.fn();
    const isRegistrationEnabled = jest.fn();
    const consume = jest.fn();
    const input = { username: 'new-user', email: 'new-user@example.invalid', password: 'secret-password-123' };
    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                RegistrationRateLimitGuard,
                { provide: RegistrationRateLimitStore, useValue: { consume } },
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
        consume.mockResolvedValue({ allowed: true, retryAfter: 900 });
    });
    it('counts success, validation failures and conflicts before returning 429', async () => {
        for (let i = 0; i < 20; i++) {
            if (i % 3 === 0) await request(app.getHttpServer()).post('/auth/register').send({}).expect(400);
            else if (i % 3 === 1) {
                register.mockRejectedValueOnce(new ConflictException('Duplicate'));
                await request(app.getHttpServer()).post('/auth/register').send(input).expect(409);
            } else await request(app.getHttpServer()).post('/auth/register').send(input).expect(201);
        }
        expect(consume).toHaveBeenCalledTimes(20);
        consume.mockResolvedValueOnce({ allowed: false, retryAfter: 120 });
        const calls = register.mock.calls.length;
        const result = await request(app.getHttpServer()).post('/auth/register').send(input).expect(429);
        expect(result.headers['retry-after']).toBe('120');
        expect(register).toHaveBeenCalledTimes(calls);
    });
    it('returns 503 without calling registration when Redis is unavailable', async () => {
        consume.mockRejectedValue(new ServiceUnavailableException('Registration temporarily unavailable'));
        await request(app.getHttpServer()).post('/auth/register').send(input).expect(503);
        expect(register).not.toHaveBeenCalled();
    });
});

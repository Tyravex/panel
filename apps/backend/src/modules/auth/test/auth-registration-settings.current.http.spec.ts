import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RegistrationSettingsService } from '../registration-settings.service';

describe('Registration settings - public HTTP boundary', () => {
    let app: INestApplication;
    const register = jest.fn();
    const isRegistrationEnabled = jest.fn();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                { provide: AuthService, useValue: { register } },
                { provide: RegistrationSettingsService, useValue: { isRegistrationEnabled } },
            ],
        }).compile();
        app = moduleRef.createNestApplication({ logger: false });
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    });

    afterAll(async () => { await app?.close(); });
    beforeEach(() => {
        jest.resetAllMocks();
        register.mockResolvedValue({ id: 42, username: 'new-user' });
        isRegistrationEnabled.mockResolvedValue(false);
    });

    it('rejects anonymous registration by default without creating a user', async () => {
        await request(app.getHttpServer()).post('/auth/register')
            .send({ username: 'new-user', email: 'new@example.test', password: 'secret' }).expect(403);
        expect(register).not.toHaveBeenCalled();
    });

    it('allows registration only when persisted setting is enabled', async () => {
        isRegistrationEnabled.mockResolvedValue(true);
        const response = await request(app.getHttpServer()).post('/auth/register')
            .send({ username: 'new-user', email: 'new@example.test', password: 'secret-password-123' }).expect(201);
        expect(register).toHaveBeenCalledWith('new-user', 'new@example.test', 'secret-password-123');
        expect(response.body).toEqual({ id: 42, username: 'new-user' });
    });

    it('does not allow client-supplied registrationEnabled to bypass the stored setting', async () => {
        await request(app.getHttpServer()).post('/auth/register')
            .send({ username: 'new-user', email: 'new@example.test', password: 'secret', registrationEnabled: true })
            .expect(403);
        expect(register).not.toHaveBeenCalled();
    });

    it('exposes only the public registration flag', async () => {
        await request(app.getHttpServer()).get('/auth/registration-settings').expect(200, { enabled: false });
        expect(register).not.toHaveBeenCalled();
    });

    it('fails closed when reading the stored setting fails', async () => {
        isRegistrationEnabled.mockRejectedValue(new Error('Database unavailable'));
        await request(app.getHttpServer()).post('/auth/register').send({}).expect(500);
        expect(register).not.toHaveBeenCalled();
    });

    it('does not expose a public settings write endpoint', async () => {
        await request(app.getHttpServer()).patch('/auth/registration-settings')
            .send({ enabled: true }).expect(404);
    });
});

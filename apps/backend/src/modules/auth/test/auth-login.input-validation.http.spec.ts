import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RegistrationSettingsService } from '../registration-settings.service';
import { RegistrationRateLimitGuard } from '../guards/registration-rate-limit.guard';

describe('Auth login HTTP input validation', () => {
    let app: INestApplication;
    const validateUser = jest.fn();
    const login = jest.fn();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                { provide: AuthService, useValue: { validateUser, login } },
                // Login does not use registration settings, but the controller requires this dependency.
                { provide: RegistrationSettingsService, useValue: { isRegistrationEnabled: jest.fn() } },
            ],
        })
            .overrideGuard(RegistrationRateLimitGuard)
            .useValue({ canActivate: () => true })
            .compile();
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        app.use(cookieParser());
        await app.init();
    });
    afterAll(async () => { await app?.close(); });
    beforeEach(() => { jest.resetAllMocks(); });

    it.each([
        ['empty object', {}],
        ['missing password', { usernameOrEmail: 'tester' }],
        ['missing username', { password: 'secret' }],
        ['empty strings', { usernameOrEmail: '', password: '' }],
        ['null username', { usernameOrEmail: null, password: 'secret' }],
        ['null password', { usernameOrEmail: 'tester', password: null }],
        ['false password', { usernameOrEmail: 'tester', password: false }],
    ])('rejects %s before credential lookup', async (_label, body) => {
        await request(app.getHttpServer()).post('/auth/login').send(body).expect(400);
        expect(validateUser).not.toHaveBeenCalled();
        expect(login).not.toHaveBeenCalled();
    });

    it.each([
        ['numeric username', { usernameOrEmail: 123, password: 'secret' }, 123, 'secret'],
        ['object username', { usernameOrEmail: { nested: true }, password: 'secret' }, { nested: true }, 'secret'],
        ['array password', { usernameOrEmail: 'tester', password: ['secret'] }, 'tester', ['secret']],
        ['additional fields', { usernameOrEmail: 'tester', password: 'secret', isAdmin: true }, 'tester', 'secret'],
    ])('forwards %s without runtime DTO validation', async (_label, body, username, password) => {
        validateUser.mockResolvedValue(null);
        await request(app.getHttpServer()).post('/auth/login').send(body).expect(401);
        expect(validateUser).toHaveBeenCalledWith(username, password);
        expect(login).not.toHaveBeenCalled();
    });

    it('does not issue cookies for invalid credentials', async () => {
        validateUser.mockResolvedValue(null);
        const response = await request(app.getHttpServer()).post('/auth/login')
            .send({ usernameOrEmail: 'tester', password: 'wrong' }).expect(401);
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(login).not.toHaveBeenCalled();
    });

    it('issues HTTP-only cookies only after successful login', async () => {
        const user = { id: 7, username: 'tester' };
        validateUser.mockResolvedValue(user);
        login.mockResolvedValue({ access_token: 'access-value', refresh_token: 'refresh-value' });
        const response = await request(app.getHttpServer()).post('/auth/login')
            .send({ usernameOrEmail: 'tester', password: 'secret' }).expect(201);
        const cookies = response.headers['set-cookie'] as unknown as string[];
        expect(cookies).toEqual(expect.arrayContaining([
            expect.stringContaining('access_token=access-value'),
            expect.stringContaining('refresh_token=refresh-value'),
        ]));
        expect(cookies.every((cookie) => cookie.includes('HttpOnly'))).toBe(true);
        expect(login).toHaveBeenCalledWith(user);
        expect(response.body).toEqual({ success: true });
    });
});

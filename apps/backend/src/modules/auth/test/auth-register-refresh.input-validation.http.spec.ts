import { BadRequestException, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RegistrationSettingsService } from '../registration-settings.service';

describe('Auth register and refresh HTTP input boundaries', () => {
    let app: INestApplication;
    const register = jest.fn();
    const refreshToken = jest.fn();
    const isRegistrationEnabled = jest.fn();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                { provide: AuthService, useValue: { register, refreshToken } },
                { provide: RegistrationSettingsService, useValue: { isRegistrationEnabled } },
            ],
        }).compile();
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        app.use(cookieParser());
        await app.init();
    });
    afterAll(async () => { await app?.close(); });
    beforeEach(() => { jest.resetAllMocks(); isRegistrationEnabled.mockResolvedValue(true); });

    it.each([
        ['empty body', {}, undefined, undefined, undefined],
        ['missing password', { username: 'tester', email: 'tester@example.invalid' }, 'tester', 'tester@example.invalid', undefined],
        ['invalid types', { username: 123, email: false, password: [] }, 123, false, []],
        ['extra fields', { username: 'tester', email: 'tester@example.invalid', password: 'secret', isAdmin: true }, 'tester', 'tester@example.invalid', 'secret'],
    ])('forwards %s to register without DTO validation when enabled', async (_label, body, username, email, password) => {
        register.mockResolvedValue({ id: 7 });
        await request(app.getHttpServer()).post('/auth/register').send(body).expect(201);
        expect(register).toHaveBeenCalledWith(username, email, password);
    });

    it('returns registration service validation errors as HTTP 400', async () => {
        register.mockRejectedValue(new BadRequestException('Invalid registration'));
        await request(app.getHttpServer()).post('/auth/register').send({}).expect(400);
        expect(register).toHaveBeenCalledTimes(1);
    });

    it.each([['missing cookie', undefined], ['empty cookie', '']])('rejects refresh with %s without invoking service', async (_label, cookie) => {
        const req = request(app.getHttpServer()).post('/auth/refresh').send({});
        if (cookie !== undefined) req.set('Cookie', `refresh_token=${cookie}`);
        await req.expect(401);
        expect(refreshToken).not.toHaveBeenCalled();
    });

    it('ignores refresh tokens supplied only in JSON body', async () => {
        await request(app.getHttpServer()).post('/auth/refresh').send({ refresh_token: 'body-token' }).expect(401);
        expect(refreshToken).not.toHaveBeenCalled();
    });

    it('uses refresh cookie rather than token or identity from JSON body', async () => {
        refreshToken.mockRejectedValue(new UnauthorizedException('Invalid refresh token'));
        await request(app.getHttpServer()).post('/auth/refresh')
            .set('Cookie', 'refresh_token=cookie-token')
            .send({ refresh_token: 'body-token', userId: 999 }).expect(401);
        expect(refreshToken).toHaveBeenCalledWith('cookie-token');
    });

    it('sets only an HTTP-only access cookie on successful refresh', async () => {
        refreshToken.mockResolvedValue({ access_token: 'renewed-access' });
        const response = await request(app.getHttpServer()).post('/auth/refresh')
            .set('Cookie', 'refresh_token=valid-token').send({}).expect(201);
        const cookies = response.headers['set-cookie'] as unknown as string[];
        expect(cookies).toHaveLength(1);
        expect(cookies[0]).toContain('access_token=renewed-access');
        expect(cookies[0]).toContain('HttpOnly');
        expect(response.body).toEqual({ success: true });
    });
});

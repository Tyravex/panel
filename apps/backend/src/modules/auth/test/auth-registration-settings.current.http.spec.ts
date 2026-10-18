import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

// Characterize the current public registration endpoint before adding an admin switch.
describe('Registration settings - current HTTP boundary', () => {
    let app: INestApplication;
    const register = jest.fn();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [{ provide: AuthService, useValue: { register } }],
        }).compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }));
        await app.init();
    });

    afterAll(async () => {
        await app?.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
        register.mockResolvedValue({ id: 42, username: 'new-user' });
    });

    it('currently allows anonymous registration without an admin setting check', async () => {
        const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ username: 'new-user', email: 'new@example.test', password: 'secret' })
            .expect(201);

        expect(register).toHaveBeenCalledWith('new-user', 'new@example.test', 'secret');
        expect(response.body).toEqual({ id: 42, username: 'new-user' });
    });

    it('does not accept a client-supplied registrationEnabled flag as a service argument', async () => {
        await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                username: 'new-user',
                email: 'new@example.test',
                password: 'secret',
                registrationEnabled: true,
            })
            .expect(201);

        expect(register).toHaveBeenCalledTimes(1);
        expect(register).toHaveBeenCalledWith('new-user', 'new@example.test', 'secret');
    });

    it('currently exposes no registration-settings endpoint on AuthController', async () => {
        await request(app.getHttpServer()).get('/auth/registration-settings').expect(404);
        await request(app.getHttpServer()).patch('/auth/registration-settings')
            .send({ enabled: true }).expect(404);
        expect(register).not.toHaveBeenCalled();
    });
});

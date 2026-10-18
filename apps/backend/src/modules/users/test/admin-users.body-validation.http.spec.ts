import { BadRequestException, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../rbac/guards/permissions.guard';
import { AdminUsersController } from '../admin-users.controller';
import { AdminUsersService } from '../admin-users.service';

const allowAdmin = {
    canActivate: (context: ExecutionContext) => {
        context.switchToHttp().getRequest().user = { id: 7 };
        return true;
    },
};

describe('Admin users HTTP body validation characterization', () => {
    let app: INestApplication;
    const create = jest.fn();
    const update = jest.fn();
    const setActive = jest.fn();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [AdminUsersController],
            providers: [{ provide: AdminUsersService, useValue: { create, update, setActive } }],
        })
            .overrideGuard(JwtAuthGuard).useValue(allowAdmin)
            .overrideGuard(PermissionsGuard).useValue(allowAdmin)
            .compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }));
        await app.init();
    });

    afterAll(async () => { await app?.close(); });

    beforeEach(() => {
        jest.resetAllMocks();
        create.mockResolvedValue({ id: 9 });
        update.mockResolvedValue({ id: 9 });
        setActive.mockResolvedValue({ id: 9, isActive: false });
    });

    it.each([
        ['empty body', {}],
        ['invalid field types', { username: 42, email: false, password: [] }],
        ['extra field', { username: 'tester', email: 'tester@example.invalid', password: 'password12345', isActive: true }],
    ])('passes %s to create service despite the global ValidationPipe', async (_label, body) => {
        await request(app.getHttpServer())
            .post('/admin/users').send(body).expect(201);
        expect(create).toHaveBeenCalledWith(body, 7);
    });

    it.each([
        ['empty body', {}],
        ['invalid field types', { username: [], email: 42 }],
        ['extra field', { username: 'tester', email: 'tester@example.invalid', isActive: false }],
    ])('passes %s to update service despite the global ValidationPipe', async (_label, body) => {
        await request(app.getHttpServer())
            .patch('/admin/users/9').send(body).expect(200);
        expect(update).toHaveBeenCalledWith(9, body, 7);
    });

    it.each([
        ['string false', { isActive: 'false' }, 'false'],
        ['numeric false', { isActive: 0 }, 0],
        ['missing status', {}, undefined],
        ['extra field', { isActive: false, isOwner: true }, false],
    ])('passes %s to status service despite the global ValidationPipe', async (_label, body, value) => {
        await request(app.getHttpServer())
            .patch('/admin/users/9/status').send(body).expect(200);
        expect(setActive).toHaveBeenCalledWith(9, value, 7);
    });

    it('returns a service-level create validation error as HTTP 400', async () => {
        create.mockRejectedValue(new BadRequestException('Invalid email'));
        await request(app.getHttpServer())
            .post('/admin/users').send({ username: 'tester', email: 'invalid' }).expect(400);
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('returns a service-level status validation error as HTTP 400', async () => {
        setActive.mockRejectedValue(new BadRequestException('Invalid user status'));
        await request(app.getHttpServer())
            .patch('/admin/users/9/status').send({ isActive: 'false' }).expect(400);
        expect(setActive).toHaveBeenCalledTimes(1);
    });
});

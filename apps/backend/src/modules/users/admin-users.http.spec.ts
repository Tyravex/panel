import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request from 'supertest';

import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersController HTTP permissions', () => {
    let app: INestApplication;
    const originalJwtSecret = process.env.JWT_SECRET;

    const list = jest.fn();
    const get = jest.fn();
    const create = jest.fn();
    const update = jest.fn();
    const setActive = jest.fn();
    const findUnique = jest.fn();
    const sessionFindUnique = jest.fn();

    const tokenFor = (permissions: string[], isActive = true) => {
        findUnique.mockResolvedValue({
            id: 7,
            username: 'staff-user',
            email: 'staff@example.invalid',
            avatar: null,
            language: 'en',
            isActive,
            createdAt: new Date(),
            updatedAt: new Date(),
            roles: [{ role: { name: 'Staff', permissions: permissions.map((name) => ({ name })) } }],
        });
        sessionFindUnique.mockResolvedValue({
            id: 'admin-users-test-session',
            userId: 7,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
        });
        return sign(
            { sub: 7, email: 'staff@example.invalid', sid: 'admin-users-test-session', tokenType: 'access' },
            process.env.JWT_SECRET!,
            { expiresIn: '1h' },
        );
    };

    beforeAll(async () => {
        process.env.JWT_SECRET = 'tyravex-admin-users-http-test-secret';
        const moduleRef = await Test.createTestingModule({
            controllers: [AdminUsersController],
            providers: [
                { provide: AdminUsersService, useValue: { list, get, create, update, setActive } },
                {
                    provide: PrismaService,
                    useValue: { user: { findUnique }, session: { findUnique: sessionFindUnique } },
                },
                JwtStrategy,
                PermissionsGuard,
            ],
        }).compile();
        app = moduleRef.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app?.close();
        if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalJwtSecret;
    });

    beforeEach(() => {
        jest.resetAllMocks();
        list.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, pages: 0 });
        get.mockResolvedValue({ id: 9 });
        create.mockResolvedValue({ id: 9 });
        update.mockResolvedValue({ id: 9 });
        setActive.mockResolvedValue({ id: 9, isActive: false });
    });

    it('rejects unauthenticated requests', async () => {
        await request(app.getHttpServer()).get('/admin/users').expect(401);
        await request(app.getHttpServer()).post('/admin/users').send({}).expect(401);
        expect(list).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
    });

    it('allows user:read to list and inspect accounts', async () => {
        const token = tokenFor(['user:read']);
        await request(app.getHttpServer()).get('/admin/users?page=2&status=active')
            .set('Authorization', `Bearer ${token}`).expect(200);
        expect(list).toHaveBeenCalledWith('2', undefined, 'active');
        await request(app.getHttpServer()).get('/admin/users/9')
            .set('Authorization', `Bearer ${token}`).expect(200);
        expect(get).toHaveBeenCalledWith(9);
    });

    it('prevents user:read from creating, editing, or disabling accounts', async () => {
        const token = tokenFor(['user:read']);
        await request(app.getHttpServer()).post('/admin/users')
            .set('Authorization', `Bearer ${token}`)
            .send({ username: 'new-user', email: 'new@example.invalid', password: 'a-long-password' })
            .expect(403);
        await request(app.getHttpServer()).patch('/admin/users/9')
            .set('Authorization', `Bearer ${token}`)
            .send({ username: 'changed', email: 'changed@example.invalid' })
            .expect(403);
        await request(app.getHttpServer()).patch('/admin/users/9/status')
            .set('Authorization', `Bearer ${token}`)
            .send({ isActive: false }).expect(403);
        expect(create).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(setActive).not.toHaveBeenCalled();
    });

    it('allows user:manage to mutate accounts', async () => {
        const token = tokenFor(['user:manage']);
        await request(app.getHttpServer()).post('/admin/users')
            .set('Authorization', `Bearer ${token}`)
            .send({ username: 'new-user', email: 'new@example.invalid', password: 'a-long-password' })
            .expect(201);
        expect(create).toHaveBeenCalledWith({
            username: 'new-user', email: 'new@example.invalid', password: 'a-long-password',
        }, 7);

        await request(app.getHttpServer()).patch('/admin/users/9')
            .set('Authorization', `Bearer ${token}`)
            .send({ username: 'changed', email: 'changed@example.invalid' }).expect(200);
        expect(update).toHaveBeenCalledWith(9, {
            username: 'changed', email: 'changed@example.invalid',
        }, 7);

        await request(app.getHttpServer()).patch('/admin/users/9/status')
            .set('Authorization', `Bearer ${token}`)
            .send({ isActive: false }).expect(200);
        expect(setActive).toHaveBeenCalledWith(9, false, 7);
    });

    it('rejects disabled accounts even with a valid JWT and permissions', async () => {
        const token = tokenFor(['user:read', 'user:manage'], false);
        await request(app.getHttpServer()).get('/admin/users')
            .set('Authorization', `Bearer ${token}`).expect(401);
        expect(list).not.toHaveBeenCalled();
    });

    it('rejects a valid JWT with no relevant permissions', async () => {
        const token = tokenFor([]);
        await request(app.getHttpServer()).get('/admin/users')
            .set('Authorization', `Bearer ${token}`).expect(403);
        expect(list).not.toHaveBeenCalled();
    });
});

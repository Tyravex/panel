import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request from 'supertest';

import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { PermissionsGuard } from '../../../rbac/guards/permissions.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminUsersController } from '../admin-users.controller';
import { AdminUsersService } from '../admin-users.service';

describe('Admin users HTTP parameter validation', () => {
    let app: INestApplication;
    const previousSecret = process.env.JWT_SECRET;
    const secret = 'tyravex-admin-users-parameter-test-secret';
    const get = jest.fn();
    const update = jest.fn();
    const setActive = jest.fn();
    const findUnique = jest.fn();
    const sessionFindUnique = jest.fn();

    beforeAll(async () => {
        process.env.JWT_SECRET = secret;
        const moduleRef = await Test.createTestingModule({
            controllers: [AdminUsersController],
            providers: [
                {
                    provide: AdminUsersService,
                    useValue: {
                        list: jest.fn(),
                        get,
                        create: jest.fn(),
                        update,
                        setActive,
                    },
                },
                {
                    provide: PrismaService,
                    useValue: {
                        user: { findUnique },
                        session: { findUnique: sessionFindUnique },
                    },
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
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
    });

    beforeEach(() => {
        jest.resetAllMocks();
        findUnique.mockResolvedValue({
            id: 7,
            username: 'test-admin',
            email: 'test-admin@example.invalid',
            isActive: true,
            avatar: null,
            language: 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
            roles: [{
                role: {
                    name: 'Staff',
                    permissions: [{ name: 'user:read' }, { name: 'user:manage' }],
                },
            }],
        });
        sessionFindUnique.mockResolvedValue({
            id: 'admin-params-session',
            userId: 7,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
        });
        get.mockResolvedValue({ id: 9 });
        update.mockResolvedValue({ id: 9 });
        setActive.mockResolvedValue({ id: 9, isActive: false });
    });

    function authorization() {
        const token = sign(
            { sub: 7, sid: 'admin-params-session', tokenType: 'access' },
            secret,
            { expiresIn: '1h' },
        );
        return `Bearer ${token}`;
    }

    it.each(['abc', '1.5', '-not-an-id', '2147483648x'])(
        'rejects malformed ID %s on account lookup without calling the service',
        async (id) => {
            await request(app.getHttpServer())
                .get(`/admin/users/${id}`)
                .set('Authorization', authorization())
                .expect(400);
            expect(get).not.toHaveBeenCalled();
        },
    );

    it.each(['abc', '1.5', '-not-an-id'])(
        'rejects malformed ID %s on account update without calling the service',
        async (id) => {
            await request(app.getHttpServer())
                .patch(`/admin/users/${id}`)
                .set('Authorization', authorization())
                .send({ username: 'changed' })
                .expect(400);
            expect(update).not.toHaveBeenCalled();
        },
    );

    it.each(['abc', '1.5', '-not-an-id'])(
        'rejects malformed ID %s on status update without calling the service',
        async (id) => {
            await request(app.getHttpServer())
                .patch(`/admin/users/${id}/status`)
                .set('Authorization', authorization())
                .send({ isActive: false })
                .expect(400);
            expect(setActive).not.toHaveBeenCalled();
        },
    );

    it('converts a valid account ID to a number on lookup', async () => {
        await request(app.getHttpServer())
            .get('/admin/users/9')
            .set('Authorization', authorization())
            .expect(200);
        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith(9);
    });

    it('converts a valid account ID to a number on update', async () => {
        await request(app.getHttpServer())
            .patch('/admin/users/9')
            .set('Authorization', authorization())
            .send({ username: 'changed' })
            .expect(200);
        expect(update).toHaveBeenCalledWith(9, { username: 'changed' }, 7);
    });

    it('converts a valid account ID to a number on status update', async () => {
        await request(app.getHttpServer())
            .patch('/admin/users/9/status')
            .set('Authorization', authorization())
            .send({ isActive: false })
            .expect(200);
        expect(setActive).toHaveBeenCalledWith(9, false, 7);
    });
});

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';

describe('Notifications HTTP access boundaries', () => {
    let app: INestApplication;
    const userFindUnique = jest.fn();
    const sessionFindUnique = jest.fn();
    const notificationFindMany = jest.fn();
    const notificationUpdateMany = jest.fn();
    const previousSecret = process.env.JWT_SECRET;
    const secret = 'notifications-access-security-test-secret';

    function token(userId = 12, sessionId = 'session-12') {
        return sign({ sub: userId, sid: sessionId, tokenType: 'access', email: 'test@example.invalid' }, secret, { expiresIn: '1h' });
    }

    beforeAll(async () => {
        process.env.JWT_SECRET = secret;
        const moduleRef = await Test.createTestingModule({
            controllers: [NotificationsController],
            providers: [
                NotificationsService,
                JwtStrategy,
                {
                    provide: PrismaService,
                    useValue: {
                        user: { findUnique: userFindUnique },
                        session: { findUnique: sessionFindUnique },
                        notification: { findMany: notificationFindMany, updateMany: notificationUpdateMany },
                    },
                },
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
        userFindUnique.mockResolvedValue({
            id: 12, username: 'tester', email: 'test@example.invalid', isActive: true,
            avatar: null, language: 'en', createdAt: new Date(), updatedAt: new Date(), roles: [],
        });
        sessionFindUnique.mockResolvedValue({
            id: 'session-12', userId: 12, revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
        });
    });

    it('rejects notification listing without authentication', async () => {
        await request(app.getHttpServer()).get('/notifications').expect(401);
        expect(notificationFindMany).not.toHaveBeenCalled();
    });

    it('returns only notifications queried for the JWT user', async () => {
        notificationFindMany.mockResolvedValue([{ id: 7, userId: 12, content: 'Private' }]);
        await request(app.getHttpServer())
            .get('/notifications')
            .set('Authorization', `Bearer ${token()}`)
            .expect(200, [{ id: 7, userId: 12, content: 'Private' }]);
        expect(notificationFindMany).toHaveBeenCalledWith({
            where: { userId: 12 }, orderBy: { createdAt: 'desc' },
        });
    });

    it('rejects listing with a refresh token', async () => {
        const refresh = sign({ sub: 12, sid: 'session-12', tokenType: 'refresh' }, secret);
        await request(app.getHttpServer()).get('/notifications')
            .set('Authorization', `Bearer ${refresh}`).expect(401);
        expect(notificationFindMany).not.toHaveBeenCalled();
    });

    it('rejects listing for a revoked session', async () => {
        sessionFindUnique.mockResolvedValue({
            id: 'session-12', userId: 12, revokedAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
        });
        await request(app.getHttpServer()).get('/notifications')
            .set('Authorization', `Bearer ${token()}`).expect(401);
        expect(notificationFindMany).not.toHaveBeenCalled();
    });

    it('rejects read updates without authentication', async () => {
        await request(app.getHttpServer()).patch('/notifications/7/read').expect(401);
        expect(notificationUpdateMany).not.toHaveBeenCalled();
    });

    it.each(['0', '-1', 'not-a-number', '1.5', '9007199254740992'])(
        'does not update a notification with invalid ID %s', async (id) => {
            await request(app.getHttpServer())
                .patch(`/notifications/${id}/read`)
                .set('Authorization', `Bearer ${token()}`)
                .expect(200, '');
            expect(notificationUpdateMany).not.toHaveBeenCalled();
        },
    );

    it('does not mark another user notification as read', async () => {
        notificationUpdateMany.mockResolvedValue({ count: 0 });
        await request(app.getHttpServer())
            .patch('/notifications/7/read')
            .set('Authorization', `Bearer ${token()}`)
            .expect(200, 'false');
        expect(notificationUpdateMany).toHaveBeenCalledWith({
            where: { id: 7, userId: 12 }, data: { read: true },
        });
    });
});

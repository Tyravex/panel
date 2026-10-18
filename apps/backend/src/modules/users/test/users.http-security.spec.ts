import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { UserController } from '../users.controller';
import { UsersService } from '../users.service';

describe('User preferences HTTP security boundaries', () => {
    let app: INestApplication;
    const previousSecret = process.env.JWT_SECRET;
    const secret = 'user-preferences-http-security-test-secret';
    const userFindUnique = jest.fn();
    const sessionFindUnique = jest.fn();
    const updatePreferences = jest.fn();

    function token(userId = 12, sessionId = 'session-12', tokenType = 'access') {
        return sign({ sub: userId, sid: sessionId, tokenType }, secret, { expiresIn: '1h' });
    }

    beforeAll(async () => {
        process.env.JWT_SECRET = secret;
        const moduleRef = await Test.createTestingModule({
            controllers: [UserController],
            providers: [
                JwtStrategy,
                { provide: UsersService, useValue: { updatePreferences } },
                {
                    provide: PrismaService,
                    useValue: {
                        user: { findUnique: userFindUnique },
                        session: { findUnique: sessionFindUnique },
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
        userFindUnique.mockImplementation(async ({ where }: { where: { id: number } }) => ({
            id: where.id,
            username: `user-${where.id}`,
            email: `user-${where.id}@example.invalid`,
            avatar: null,
            language: 'en',
            isActive: true,
            createdAt: new Date('2025-01-01T00:00:00Z'),
            updatedAt: new Date('2025-01-01T00:00:00Z'),
            roles: [],
            password: 'private-hash',
        }));
        sessionFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
            id: where.id,
            userId: where.id === 'session-13' ? 13 : 12,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
        }));
        updatePreferences.mockImplementation(async (id: number, data: { language: string }) => ({
            id,
            username: `user-${id}`,
            language: data.language,
        }));
    });

    it('rejects unauthenticated profile and preferences requests', async () => {
        await request(app.getHttpServer()).get('/user/me').expect(401);
        await request(app.getHttpServer()).patch('/user/preferences').send({ language: 'en' }).expect(401);
        expect(updatePreferences).not.toHaveBeenCalled();
    });

    it('returns the authenticated identity without exposing password hashes', async () => {
        const response = await request(app.getHttpServer()).get('/user/me')
            .set('Authorization', `Bearer ${token()}`).expect(200);
        expect(response.body).toMatchObject({ id: 12, username: 'user-12', language: 'en' });
        expect(response.body).not.toHaveProperty('password');
    });

    it('updates only the identity obtained from JWT, ignoring client userId', async () => {
        await request(app.getHttpServer()).patch('/user/preferences')
            .set('Authorization', `Bearer ${token()}`)
            .send({ language: 'pl', userId: 13 })
            .expect(200);
        expect(updatePreferences).toHaveBeenCalledWith(12, { language: 'pl', userId: 13 });
        expect(updatePreferences).not.toHaveBeenCalledWith(13, expect.anything());
    });

    it('scopes preference changes to a second authenticated identity', async () => {
        await request(app.getHttpServer()).patch('/user/preferences')
            .set('Authorization', `Bearer ${token(13, 'session-13')}`)
            .send({ language: 'en' }).expect(200);
        expect(updatePreferences).toHaveBeenCalledWith(13, { language: 'en' });
    });

    it('rejects refresh tokens on the preferences endpoint', async () => {
        await request(app.getHttpServer()).patch('/user/preferences')
            .set('Authorization', `Bearer ${token(12, 'session-12', 'refresh')}`)
            .send({ language: 'en' }).expect(401);
        expect(updatePreferences).not.toHaveBeenCalled();
    });

    it('rejects a revoked session', async () => {
        sessionFindUnique.mockResolvedValueOnce({
            id: 'session-12', userId: 12, revokedAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
        });
        await request(app.getHttpServer()).patch('/user/preferences')
            .set('Authorization', `Bearer ${token()}`)
            .send({ language: 'en' }).expect(401);
        expect(updatePreferences).not.toHaveBeenCalled();
    });

    it('rejects a session belonging to another user', async () => {
        sessionFindUnique.mockResolvedValueOnce({
            id: 'session-12', userId: 13, revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
        });
        await request(app.getHttpServer()).patch('/user/preferences')
            .set('Authorization', `Bearer ${token()}`)
            .send({ language: 'en' }).expect(401);
        expect(updatePreferences).not.toHaveBeenCalled();
    });

    it('rejects a disabled account', async () => {
        userFindUnique.mockResolvedValueOnce({ id: 12, isActive: false, roles: [] });
        await request(app.getHttpServer()).get('/user/me')
            .set('Authorization', `Bearer ${token()}`).expect(401);
    });
});

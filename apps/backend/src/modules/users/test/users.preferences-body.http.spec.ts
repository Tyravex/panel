import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request from 'supertest';

import { PrismaService } from '@/prisma/prisma.service';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { UserController } from '../users.controller';
import { UsersService } from '../users.service';

describe('User preferences HTTP body validation characterization', () => {
    let app: INestApplication;
    const originalSecret = process.env.JWT_SECRET;
    const secret = 'tyravex-preferences-body-test-secret';
    const userFindUnique = jest.fn();
    const sessionFindUnique = jest.fn();
    const updatePreferences = jest.fn();

    function bearer() {
        return `Bearer ${sign(
            { sub: 12, sid: 'preferences-body-session', tokenType: 'access' },
            secret,
            { expiresIn: '1h' },
        )}`;
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
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }));
        await app.init();
    });

    afterAll(async () => {
        await app?.close();
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });

    beforeEach(() => {
        jest.resetAllMocks();
        userFindUnique.mockResolvedValue({
            id: 12, username: 'test-user', email: 'test@example.invalid',
            isActive: true, roles: [], language: 'en',
        });
        sessionFindUnique.mockResolvedValue({
            id: 'preferences-body-session', userId: 12,
            revokedAt: null, expiresAt: new Date(Date.now() + 60_000),
        });
        updatePreferences.mockImplementation(async (id: number, body: { language?: unknown }) => ({
            id, language: body.language ?? null,
        }));
    });

    it.each([
        ['empty object', {}],
        ['numeric language', { language: 123 }],
        ['boolean language', { language: false }],
        ['array language', { language: ['en'] }],
        ['unsupported language', { language: 'xx-not-installed' }],
        ['additional properties', { language: 'en', isAdmin: true, userId: 999 }],
    ])('forwards %s to the service despite global ValidationPipe', async (_label, body) => {
        await request(app.getHttpServer())
            .patch('/user/preferences')
            .set('Authorization', bearer())
            .send(body)
            .expect(200);

        expect(updatePreferences).toHaveBeenCalledWith(12, body);
    });

    it('takes the target user ID from JWT rather than request body', async () => {
        await request(app.getHttpServer())
            .patch('/user/preferences')
            .set('Authorization', bearer())
            .send({ language: 'pl', userId: 999 })
            .expect(200);

        expect(updatePreferences).toHaveBeenCalledWith(12, { language: 'pl', userId: 999 });
        expect(updatePreferences).not.toHaveBeenCalledWith(999, expect.anything());
    });

    it('rejects unauthenticated invalid bodies before invoking the service', async () => {
        await request(app.getHttpServer())
            .patch('/user/preferences')
            .send({ language: 123, userId: 999 })
            .expect(401);

        expect(updatePreferences).not.toHaveBeenCalled();
    });
});

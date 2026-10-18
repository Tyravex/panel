
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { sign } from 'jsonwebtoken';

import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { PrismaService } from '@/prisma/prisma.service';

describe('NotificationsController HTTP security', () => {
  let app: INestApplication;

  const findUnique = jest.fn();
  const sessionFindUnique = jest.fn();
  const updateMany = jest.fn();
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(async () => {
    // Use a test-only secret.
    process.env.JWT_SECRET = 'tyravex-notifications-http-test-only';

    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationsService,
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique },
            session: { findUnique: sessionFindUnique },
            notification: { updateMany },
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 without JWT', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/10/read')
      .expect(401);

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('restricts the update to the authenticated user', async () => {
    findUnique.mockResolvedValue({
      id: 2,
      username: 'regular-user',
      email: 'regular@example.invalid',
      isActive: true,
      avatar: null,
      language: 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: [],
    });

    // No notification matches both ID 10 and user ID 2.
    sessionFindUnique.mockResolvedValue({
      id: 'notifications-http-session',
      userId: 2,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    updateMany.mockResolvedValue({ count: 0 });

    const token = sign(
      {
        sub: 2,
        email: 'regular@example.invalid',
        sid: 'notifications-http-session',
        tokenType: 'access',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' },
    );

    await request(app.getHttpServer())
      .patch('/notifications/10/read')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, 'false');

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 10, userId: 2 },
      data: { read: true },
    });
  });

  it('does not expose the removed test endpoint', async () => {
    await request(app.getHttpServer())
      .get('/test/notify')
      .expect(404);
  });
});

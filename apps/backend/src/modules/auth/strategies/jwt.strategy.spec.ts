import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '@/prisma/prisma.service';

describe('JwtStrategy', () => {
  const findUnique = jest.fn();

  const testUser = {
    id: 1,
    username: 'test-user',
    email: 'test@example.com',
    avatar: null,
    language: 'en',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    roles: [],
  };

  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.JWT_SECRET = 'test-only-jwt-secret';

    const sessionFindUnique = jest.fn().mockResolvedValue({
      id: 'session-123',
      userId: 1,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      revokedAt: null,
    });

    strategy = new JwtStrategy({
      user: { findUnique },
      session: { findUnique: sessionFindUnique },
    } as unknown as PrismaService);
  });

  it('combines permissions from multiple roles without duplicates', async () => {
    findUnique.mockResolvedValue({
      ...testUser,
      roles: [
        {
          role: {
            name: 'Support',
            permissions: [
              { name: 'user:read' },
              { name: 'server:manage:any' },
            ],
          },
        },
        {
          role: {
            name: 'Billing',
            permissions: [
              { name: 'user:read' },
              { name: 'billing:read' },
            ],
          },
        },
      ],
    });

    const user = await strategy.validate({
      sub: 1,
      email: 'test@example.com',
      sid: 'session-123',
      tokenType: 'access',
    });

    expect(user.roles).toEqual(['Support', 'Billing']);
    expect(user.permissions).toEqual([
      'user:read',
      'server:manage:any',
      'billing:read',
    ]);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
      }),
    );
  });

  it('rejects an invalid user ID', async () => {
    await expect(
      strategy.validate({
        sub: 'invalid',
        email: 'test@example.com',
        tokenType: 'access',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects a user that no longer exists', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 1,
        email: 'missing@example.com',
        sid: 'session-123',
        tokenType: 'access',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token without a session ID', async () => {
    findUnique.mockResolvedValue(testUser);

    await expect(
      strategy.validate({
        sub: 1,
        email: 'test@example.com',
        tokenType: 'access',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a revoked session', async () => {
    findUnique.mockResolvedValue(testUser);

    const sessionFindUnique = jest.fn().mockResolvedValue({
      id: 'session-123',
      userId: 1,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    });

    strategy = new JwtStrategy({
      user: { findUnique },
      session: { findUnique: sessionFindUnique },
    } as unknown as PrismaService);

    await expect(
      strategy.validate({
        sub: 1,
        sid: 'session-123',
        tokenType: 'access',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired session', async () => {
    findUnique.mockResolvedValue(testUser);

    const sessionFindUnique = jest.fn().mockResolvedValue({
      id: 'session-123',
      userId: 1,
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
    });

    strategy = new JwtStrategy({
      user: { findUnique },
      session: { findUnique: sessionFindUnique },
    } as unknown as PrismaService);

    await expect(
      strategy.validate({
        sub: 1,
        sid: 'session-123',
        tokenType: 'access',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts an active session belonging to the user', async () => {
    findUnique.mockResolvedValue(testUser);

    const sessionFindUnique = jest.fn().mockResolvedValue({
      id: 'session-123',
      userId: 1,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });

    strategy = new JwtStrategy({
      user: { findUnique },
      session: { findUnique: sessionFindUnique },
    } as unknown as PrismaService);

    const user = await strategy.validate({
      sub: 1,
      sid: 'session-123',
      tokenType: 'access',
    });

    expect(user.id).toBe(1);
    expect(sessionFindUnique).toHaveBeenCalledWith({
      where: { id: 'session-123' },
    });
  });

  it('rejects a session belonging to another user', async () => {
    findUnique.mockResolvedValue(testUser);

    const sessionFindUnique = jest.fn().mockResolvedValue({
      id: 'session-123',
      userId: 2,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });

    strategy = new JwtStrategy({
      user: { findUnique },
      session: { findUnique: sessionFindUnique },
    } as unknown as PrismaService);

    await expect(
      strategy.validate({
        sub: 1,
        sid: 'session-123',
        tokenType: 'access',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a refresh token used for HTTP authentication', async () => {
    findUnique.mockResolvedValue(testUser);

    await expect(
      strategy.validate({
        sub: 1,
        email: 'test@example.com',
        sid: 'session-123',
        tokenType: 'refresh',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(findUnique).not.toHaveBeenCalled();
  });
});
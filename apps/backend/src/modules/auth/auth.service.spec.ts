import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { AuthService } from './auth.service';
import { UserDTO } from '@shared/types';

describe('AuthService sessions', () => {
  const sessionCreate = jest.fn();
  const sessionFindUnique = jest.fn();
  const sessionUpdateMany = jest.fn();
  const userFindUnique = jest.fn();

  const jwtSign = jest.fn();
  const jwtVerify = jest.fn();
  const disconnectSession = jest.fn();

  let service: AuthService;

  const user: UserDTO = {
    id: 1,
    username: 'test-user',
    email: 'test@example.com',
    roles: [],
    permissions: [],
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    process.env.JWT_REFRESH_SECRET = 'test-only-refresh-secret';
    process.env.JWT_SECRET = 'test-only-access-secret';
    userFindUnique.mockResolvedValue({ isActive: true });

    service = new AuthService(
      {
        user: { findUnique: userFindUnique },
        session: {
          create: sessionCreate,
          findUnique: sessionFindUnique,
          updateMany: sessionUpdateMany,
        },
      } as unknown as PrismaService,
      {
        sign: jwtSign,
        verify: jwtVerify,
      } as unknown as JwtService,
      {
        disconnectSession,
      } as unknown as NotificationsGateway,
    );
  });

  it('creates a session and includes its ID in both tokens', async () => {
    sessionCreate.mockResolvedValue({
      id: 'session-123',
      userId: 1,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    });

    jwtSign
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('refresh-token');

    const result = await service.login(user);

    expect(sessionCreate).toHaveBeenCalledWith({
      data: {
        userId: 1,
        expiresAt: expect.any(Date),
      },
    });

    expect(jwtSign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 1,
        sid: 'session-123',
        tokenType: 'access',
      }),
      expect.objectContaining({
        expiresIn: '1h',
      }),
    );

    expect(jwtSign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 1,
        sid: 'session-123',
        tokenType: 'refresh',
      }),
      expect.objectContaining({
        expiresIn: '7d',
        secret: 'test-only-refresh-secret',
      }),
    );

    expect(result.access_token).toBe('access-token');
    expect(result.refresh_token).toBe('refresh-token');
  });

  it('rejects refresh tokens without a session ID', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      tokenType: 'refresh',
    });

    await expect(
      service.refreshToken('refresh-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(sessionFindUnique).not.toHaveBeenCalled();
  });

  it('rejects refresh tokens for revoked sessions', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      sid: 'session-123',
      tokenType: 'refresh',
    });

    sessionFindUnique.mockResolvedValue({
      id: 'session-123',
      userId: 1,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    });

    await expect(
      service.refreshToken('refresh-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(sessionFindUnique).toHaveBeenCalledWith({
      where: { id: 'session-123' },
    });

    expect(jwtSign).not.toHaveBeenCalled();
  });

  it('rejects refresh tokens for expired sessions', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      sid: 'session-123',
      tokenType: 'refresh',
    });

    sessionFindUnique.mockResolvedValue({
      id: 'session-123',
      userId: 1,
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
    });

    await expect(
      service.refreshToken('refresh-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(sessionFindUnique).toHaveBeenCalledWith({
      where: { id: 'session-123' },
    });

    expect(jwtSign).not.toHaveBeenCalled();
  });

  it('refreshes an access token for an active session', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      sid: 'session-123',
      tokenType: 'refresh',
    });

    sessionFindUnique.mockResolvedValue({
      id: 'session-123',
      userId: 1,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      revokedAt: null,
    });

    jwtSign.mockReturnValue('new-access-token');

    const result = await service.refreshToken('refresh-token');

    expect(sessionFindUnique).toHaveBeenCalledWith({
      where: {
        id: 'session-123',
      },
    });

    expect(jwtSign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 1,
        sid: 'session-123',
        tokenType: 'access',
      }),
    );

    expect(result.access_token).toBe('new-access-token');
  });

  it('rejects refresh tokens for disabled accounts', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      sid: 'session-123',
      tokenType: 'refresh',
    });
    sessionFindUnique.mockResolvedValue({
      id: 'session-123',
      userId: 1,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    userFindUnique.mockResolvedValue({ isActive: false });

    await expect(service.refreshToken('refresh-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtSign).not.toHaveBeenCalled();
  });

  it('rejects refresh tokens using another user session', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      sid: 'session-123',
      tokenType: 'refresh',
    });

    sessionFindUnique.mockResolvedValue({
      id: 'session-123',
      userId: 2,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });

    await expect(
      service.refreshToken('refresh-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(sessionFindUnique).toHaveBeenCalledWith({
      where: { id: 'session-123' },
    });

    expect(jwtSign).not.toHaveBeenCalled();
  });

  it('revokes the session identified by a valid refresh token', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      sid: 'session-123',
      tokenType: 'refresh',
    });

    sessionUpdateMany.mockResolvedValue({
      count: 1,
    });

    await service.logout('refresh-token');

    expect(jwtVerify).toHaveBeenCalledWith('refresh-token', {
      secret: 'test-only-refresh-secret',
    });

    expect(sessionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-123',
        userId: 1,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });

    expect(disconnectSession).toHaveBeenCalledTimes(1);
    expect(disconnectSession).toHaveBeenCalledWith('session-123');
  });

  it('rejects logout tokens without a session ID', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      tokenType: 'refresh',
    });

    await expect(
      service.logout('refresh-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(sessionUpdateMany).not.toHaveBeenCalled();
    expect(disconnectSession).not.toHaveBeenCalled();
  });

  it('does not revoke a session belonging to another user', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      sid: 'session-123',
      tokenType: 'refresh',
    });

    sessionUpdateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.logout('refresh-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(sessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'session-123',
          userId: 1,
        }),
      }),
    );

    expect(disconnectSession).not.toHaveBeenCalled();
  });

  it('does not disconnect the session when database revocation fails', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      sid: 'session-123',
      tokenType: 'refresh',
    });

    sessionUpdateMany.mockRejectedValue(
      new Error('Database connection failed'),
    );

    await expect(
      service.logout('refresh-token'),
    ).rejects.toThrow('Database connection failed');

    expect(sessionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-123',
        userId: 1,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });

    expect(disconnectSession).not.toHaveBeenCalled();
  });

  it('revokes a session using a verified access token', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      sid: 'session-123',
      tokenType: 'access',
    });

    sessionUpdateMany.mockResolvedValue({ count: 1 });

    await service.logoutWithAccessToken('access-token');

    expect(jwtVerify).toHaveBeenCalledWith('access-token', {
      secret: 'test-only-access-secret',
    });

    expect(sessionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-123',
        userId: 1,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });

    expect(disconnectSession).toHaveBeenCalledWith('session-123');
  });

  it('rejects an access token used as a refresh token', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      sid: 'session-123',
      tokenType: 'access',
    });

    await expect(
      service.refreshToken('access-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(sessionFindUnique).not.toHaveBeenCalled();
    expect(jwtSign).not.toHaveBeenCalled();
  });

  it('rejects an access token used for refresh-token logout', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      sid: 'session-123',
      tokenType: 'access',
    });

    sessionUpdateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.logout('access-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(sessionUpdateMany).not.toHaveBeenCalled();
    expect(disconnectSession).not.toHaveBeenCalled();
  });

  it('rejects a refresh token used for access-token logout', async () => {
    jwtVerify.mockReturnValue({
      sub: 1,
      email: 'test@example.com',
      sid: 'session-123',
      tokenType: 'refresh',
    });

    sessionUpdateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.logoutWithAccessToken('refresh-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(sessionUpdateMany).not.toHaveBeenCalled();
    expect(disconnectSession).not.toHaveBeenCalled();
  });
});
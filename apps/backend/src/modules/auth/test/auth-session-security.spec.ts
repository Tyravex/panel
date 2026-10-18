import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { AuthService } from '../auth.service';

// Cover session identity boundaries and idempotency-sensitive logout paths.
describe('AuthService additional session security', () => {
    const verify = jest.fn();
    const sign = jest.fn();
    const sessionFindUnique = jest.fn();
    const sessionUpdateMany = jest.fn();
    const userFindUnique = jest.fn();
    const disconnectSession = jest.fn();
    let service: AuthService;
    let previousRefreshSecret: string | undefined;
    let previousAccessSecret: string | undefined;

    beforeAll(() => {
        previousRefreshSecret = process.env.JWT_REFRESH_SECRET;
        previousAccessSecret = process.env.JWT_SECRET;
    });

    afterAll(() => {
        if (previousRefreshSecret === undefined) delete process.env.JWT_REFRESH_SECRET;
        else process.env.JWT_REFRESH_SECRET = previousRefreshSecret;
        if (previousAccessSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousAccessSecret;
    });

    beforeEach(() => {
        jest.resetAllMocks();
        process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
        process.env.JWT_SECRET = 'test-access-secret';
        service = new AuthService(
            {
                session: { findUnique: sessionFindUnique, updateMany: sessionUpdateMany },
                user: { findUnique: userFindUnique },
            } as unknown as PrismaService,
            { verify, sign } as unknown as JwtService,
            { disconnectSession } as unknown as NotificationsGateway,
        );
    });

    const validRefreshPayload = () => ({
        sub: 7,
        sid: 'session-7',
        email: 'user@example.test',
        tokenType: 'refresh',
    });

    it.each([0, -1, 1.5, 'not-a-number', Number.MAX_SAFE_INTEGER + 1])(
        'rejects refresh with invalid user identity %s', async (sub) => {
            verify.mockReturnValue({ ...validRefreshPayload(), sub });
            await expect(service.refreshToken('refresh')).rejects.toThrow(UnauthorizedException);
            expect(sessionFindUnique).not.toHaveBeenCalled();
            expect(sign).not.toHaveBeenCalled();
        },
    );

    it('rejects refresh when the session does not exist', async () => {
        verify.mockReturnValue(validRefreshPayload());
        sessionFindUnique.mockResolvedValue(null);
        await expect(service.refreshToken('refresh')).rejects.toThrow(UnauthorizedException);
        expect(userFindUnique).not.toHaveBeenCalled();
        expect(sign).not.toHaveBeenCalled();
    });

    it('rejects refresh when account lookup finds no user', async () => {
        verify.mockReturnValue(validRefreshPayload());
        sessionFindUnique.mockResolvedValue({
            id: 'session-7', userId: 7, revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
        });
        userFindUnique.mockResolvedValue(null);
        await expect(service.refreshToken('refresh')).rejects.toThrow(UnauthorizedException);
        expect(sign).not.toHaveBeenCalled();
    });

    it('rejects refresh when JWT verification fails', async () => {
        verify.mockImplementation(() => { throw new Error('Invalid signature'); });
        await expect(service.refreshToken('refresh')).rejects.toThrow(UnauthorizedException);
        expect(sessionFindUnique).not.toHaveBeenCalled();
    });

    it('rejects a second logout of an already revoked session', async () => {
        verify.mockReturnValue(validRefreshPayload());
        sessionUpdateMany.mockResolvedValue({ count: 0 });
        await expect(service.logout('refresh')).rejects.toThrow(UnauthorizedException);
        expect(sessionUpdateMany).toHaveBeenCalledWith({
            where: { id: 'session-7', userId: 7, revokedAt: null },
            data: { revokedAt: expect.any(Date) },
        });
        expect(disconnectSession).not.toHaveBeenCalled();
    });

    it('rejects access-token logout if JWT verification fails', async () => {
        verify.mockImplementation(() => { throw new Error('Invalid signature'); });
        await expect(service.logoutWithAccessToken('invalid')).rejects.toThrow(UnauthorizedException);
        expect(sessionUpdateMany).not.toHaveBeenCalled();
        expect(disconnectSession).not.toHaveBeenCalled();
    });
});

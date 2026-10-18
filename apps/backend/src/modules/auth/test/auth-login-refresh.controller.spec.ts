import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

// Exercise controller-level session cookies without starting an HTTP server.
describe('AuthController login and refresh', () => {
    const validateUser = jest.fn();
    const login = jest.fn();
    const refreshToken = jest.fn();
    const cookie = jest.fn();
    let controller: AuthController;
    const response = { cookie } as unknown as Response;

    beforeEach(() => {
        jest.resetAllMocks();
        controller = new AuthController({
            validateUser,
            login,
            refreshToken,
        } as unknown as AuthService);
    });

    it('rejects missing login credentials without contacting the service', async () => {
        await expect(controller.login({ usernameOrEmail: '', password: '' }, response))
            .rejects.toThrow(BadRequestException);
        expect(validateUser).not.toHaveBeenCalled();
        expect(login).not.toHaveBeenCalled();
    });

    it('rejects invalid credentials without issuing cookies', async () => {
        validateUser.mockResolvedValue(null);
        await expect(controller.login({ usernameOrEmail: 'unknown', password: 'wrong' }, response))
            .rejects.toThrow(UnauthorizedException);
        expect(login).not.toHaveBeenCalled();
        expect(cookie).not.toHaveBeenCalled();
    });

    it('issues access and refresh HTTP-only cookies after successful login', async () => {
        const user = { id: 1, username: 'tester' };
        validateUser.mockResolvedValue(user);
        login.mockResolvedValue({ access_token: 'access-123', refresh_token: 'refresh-123' });

        await expect(controller.login({ usernameOrEmail: 'tester', password: 'secret' }, response))
            .resolves.toEqual({ success: true });
        expect(validateUser).toHaveBeenCalledWith('tester', 'secret');
        expect(login).toHaveBeenCalledWith(user);
        expect(cookie).toHaveBeenCalledWith('access_token', 'access-123', expect.objectContaining({
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        }));
        expect(cookie).toHaveBeenCalledWith('refresh_token', 'refresh-123', expect.objectContaining({
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        }));
    });

    it('rejects refresh requests without a refresh cookie', async () => {
        await expect(controller.refresh({ cookies: {} } as Request, response))
            .rejects.toThrow(UnauthorizedException);
        expect(refreshToken).not.toHaveBeenCalled();
        expect(cookie).not.toHaveBeenCalled();
    });

    it('refreshes only the access cookie', async () => {
        refreshToken.mockResolvedValue({ access_token: 'new-access' });
        const request = { cookies: { refresh_token: 'refresh-123' } } as unknown as Request;

        await expect(controller.refresh(request, response)).resolves.toEqual({ success: true });
        expect(refreshToken).toHaveBeenCalledWith('refresh-123');
        expect(cookie).toHaveBeenCalledTimes(1);
        expect(cookie).toHaveBeenCalledWith('access_token', 'new-access', expect.objectContaining({
            httpOnly: true,
            sameSite: 'lax',
        }));
    });

    it('does not issue an access cookie if refresh validation fails', async () => {
        refreshToken.mockRejectedValue(new UnauthorizedException('Invalid refresh token'));
        const request = { cookies: { refresh_token: 'invalid' } } as unknown as Request;
        await expect(controller.refresh(request, response)).rejects.toThrow(UnauthorizedException);
        expect(cookie).not.toHaveBeenCalled();
    });
});

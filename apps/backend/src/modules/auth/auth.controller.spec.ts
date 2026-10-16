import { UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController logout', () => {
    const serviceLogout = jest.fn();
    const serviceLogoutWithAccessToken = jest.fn();
    const clearCookie = jest.fn();

    let controller: AuthController;

    const response = {
        clearCookie,
    } as unknown as Response;

    const requestWithToken = {
        cookies: {
            refresh_token: 'refresh-token',
        },
    } as unknown as Request;

    beforeEach(() => {
        jest.resetAllMocks();

        controller = new AuthController({
            logout: serviceLogout,
            logoutWithAccessToken: serviceLogoutWithAccessToken,
        } as unknown as AuthService);
    });

    it('revokes the session and clears both cookies', async () => {
        serviceLogout.mockResolvedValue(undefined);

        await expect(
            controller.logout(requestWithToken, response),
        ).resolves.toEqual({
            message: 'Logged out successfully',
        });

        expect(serviceLogout).toHaveBeenCalledWith('refresh-token');
        expect(clearCookie).toHaveBeenCalledWith('access_token');
        expect(clearCookie).toHaveBeenCalledWith('refresh_token');
    });

    it('clears cookies when session revocation fails', async () => {
        serviceLogout.mockRejectedValue(
            new Error('Database unavailable'),
        );

        await expect(
            controller.logout(requestWithToken, response),
        ).rejects.toThrow('Database unavailable');

        expect(serviceLogoutWithAccessToken).not.toHaveBeenCalled();
        expect(clearCookie).toHaveBeenCalledWith('access_token');
        expect(clearCookie).toHaveBeenCalledWith('refresh_token');
    });

    it('clears cookies when no refresh token exists', async () => {
        const requestWithoutToken = {
            cookies: {},
        } as Request;

        await expect(
            controller.logout(requestWithoutToken, response),
        ).resolves.toEqual({
            message: 'Logged out successfully',
        });

        expect(serviceLogout).not.toHaveBeenCalled();
        expect(clearCookie).toHaveBeenCalledWith('access_token');
        expect(clearCookie).toHaveBeenCalledWith('refresh_token');
    });

    it('revokes the session using the access token when refresh token is missing', async () => {
        const requestWithAccessToken = {
            cookies: {
                access_token: 'access-token',
            },
        } as unknown as Request;

        serviceLogoutWithAccessToken.mockResolvedValue(undefined);

        await expect(
            controller.logout(requestWithAccessToken, response),
        ).resolves.toEqual({
            message: 'Logged out successfully',
        });

        expect(serviceLogoutWithAccessToken).toHaveBeenCalledWith('access-token');
        expect(serviceLogout).not.toHaveBeenCalled();
        expect(clearCookie).toHaveBeenCalledWith('access_token');
        expect(clearCookie).toHaveBeenCalledWith('refresh_token');
    });

    it('falls back to access token when refresh token is invalid', async () => {
        const requestWithBothTokens = {
            cookies: {
                refresh_token: 'invalid-refresh-token',
                access_token: 'access-token',
            },
        } as unknown as Request;

        serviceLogout.mockRejectedValue(
            new UnauthorizedException('Invalid refresh token'),
        );
        serviceLogoutWithAccessToken.mockResolvedValue(undefined);

        await expect(
            controller.logout(requestWithBothTokens, response),
        ).resolves.toEqual({
            message: 'Logged out successfully',
        });

        expect(serviceLogout).toHaveBeenCalledWith('invalid-refresh-token');
        expect(serviceLogoutWithAccessToken).toHaveBeenCalledWith('access-token');
        expect(clearCookie).toHaveBeenCalledWith('access_token');
        expect(clearCookie).toHaveBeenCalledWith('refresh_token');
    });

    it('rejects logout when both tokens are invalid', async () => {
        const requestWithBothTokens = {
            cookies: {
                refresh_token: 'invalid-refresh-token',
                access_token: 'invalid-access-token',
            },
        } as unknown as Request;

        serviceLogout.mockRejectedValue(
            new UnauthorizedException('Invalid refresh token'),
        );
        serviceLogoutWithAccessToken.mockRejectedValue(
            new UnauthorizedException('Invalid access token'),
        );

        await expect(
            controller.logout(requestWithBothTokens, response),
        ).rejects.toThrow(UnauthorizedException);

        expect(serviceLogoutWithAccessToken).toHaveBeenCalledWith(
            'invalid-access-token',
        );
        expect(clearCookie).toHaveBeenCalledWith('access_token');
        expect(clearCookie).toHaveBeenCalledWith('refresh_token');
    });
});
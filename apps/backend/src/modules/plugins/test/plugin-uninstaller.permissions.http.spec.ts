import {
    CanActivate,
    ExecutionContext,
    INestApplication,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

import { PluginUninstallerController } from '../plugin-uninstaller.controller';
import { PluginUninstallerService } from '../plugin-uninstaller.service';

const PLUGIN_ID = 'tyravex.test.spanish';
const ENDPOINT = `/admin/plugins/${PLUGIN_ID}`;

interface TestUser {
    id?: number | string;
    userId?: number | string;
    permissions?: unknown;
}

describe('PluginUninstallerController (real PermissionsGuard HTTP)', () => {
    let app: INestApplication;

    const uninstall = jest.fn();

    let authenticated = true;
    let user: TestUser = {
        id: 7,
        permissions: ['plugin:manage'],
    };

    const jwtGuard: CanActivate = {
        canActivate(context: ExecutionContext): boolean {
            if (!authenticated) {
                throw new UnauthorizedException();
            }

            const httpRequest = context
                .switchToHttp()
                .getRequest<{ user?: TestUser }>();

            httpRequest.user = { ...user };

            return true;
        },
    };

    const sendUninstall = () =>
        request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

    beforeAll(async () => {
        const moduleRef: TestingModule =
            await Test.createTestingModule({
                controllers: [
                    PluginUninstallerController,
                ],
                providers: [
                    Reflector,
                    PermissionsGuard,
                    {
                        provide: PluginUninstallerService,
                        useValue: {
                            uninstall,
                        },
                    },
                ],
            })
                .overrideGuard(JwtAuthGuard)
                .useValue(jwtGuard)
                .compile();

        app = moduleRef.createNestApplication();
        await app.init();
    });

    beforeEach(() => {
        jest.clearAllMocks();

        authenticated = true;

        user = {
            id: 7,
            permissions: ['plugin:manage'],
        };

        uninstall.mockResolvedValue({
            id: PLUGIN_ID,
            removed: true,
            cleanupPending: false,
        });
    });

    afterAll(async () => {
        await app?.close();
    });

    it('allows an administrator with plugin:manage', async () => {
        const response = await sendUninstall();

        expect(response.status).toBe(200);

        expect(response.body).toEqual({
            id: PLUGIN_ID,
            removed: true,
            cleanupPending: false,
        });

        expect(uninstall).toHaveBeenCalledTimes(1);
        expect(uninstall).toHaveBeenCalledWith(
            PLUGIN_ID,
            7,
        );
    });

    it('allows plugin:manage among other permissions', async () => {
        user.permissions = [
            'server:read',
            'plugin:manage',
            'user:read',
        ];

        const response = await sendUninstall();

        expect(response.status).toBe(200);
        expect(uninstall).toHaveBeenCalledWith(
            PLUGIN_ID,
            7,
        );
    });

    it('returns 403 when the user has no permissions', async () => {
        user.permissions = [];

        const response = await sendUninstall();

        expect(response.status).toBe(403);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 403 when plugin:manage is missing', async () => {
        user.permissions = [
            'plugin:read',
            'server:manage',
        ];

        const response = await sendUninstall();

        expect(response.status).toBe(403);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 403 when permissions are undefined', async () => {
        delete user.permissions;

        const response = await sendUninstall();

        expect(response.status).toBe(403);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 403 when permissions are null', async () => {
        user.permissions = null;

        const response = await sendUninstall();

        expect(response.status).toBe(403);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 403 when permissions are a string', async () => {
        user.permissions = 'plugin:manage';

        const response = await sendUninstall();

        expect(response.status).toBe(403);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 403 when permissions are an object', async () => {
        user.permissions = {
            'plugin:manage': true,
        };

        const response = await sendUninstall();

        expect(response.status).toBe(403);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 403 for a similarly named permission', async () => {
        user.permissions = [
            'plugin:management',
        ];

        const response = await sendUninstall();

        expect(response.status).toBe(403);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 403 when permission casing differs', async () => {
        user.permissions = [
            'PLUGIN:MANAGE',
        ];

        const response = await sendUninstall();

        expect(response.status).toBe(403);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 403 for a wildcard permission', async () => {
        user.permissions = ['*'];

        const response = await sendUninstall();

        expect(response.status).toBe(403);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 401 when JWT authentication fails', async () => {
        authenticated = false;

        const response = await sendUninstall();

        expect(response.status).toBe(401);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 403 when the authenticated user has no permissions property', async () => {
        user = {
            id: 7,
        };

        const response = await sendUninstall();

        expect(response.status).toBe(403);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 401 when RBAC passes but administrator ID is invalid', async () => {
        user = {
            id: 'invalid',
            permissions: ['plugin:manage'],
        };

        const response = await sendUninstall();

        expect(response.status).toBe(401);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('does not let valid confirmation bypass RBAC', async () => {
        user.permissions = [
            'plugin:read',
        ];

        const response = await request(
            app.getHttpServer(),
        )
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

        expect(response.status).toBe(403);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('does not let an invalid confirmation bypass RBAC', async () => {
        user.permissions = [];

        const response = await request(
            app.getHttpServer(),
        )
            .delete(ENDPOINT)
            .send({
                confirmId: 'another.plugin',
            });

        expect(response.status).toBe(403);
        expect(uninstall).not.toHaveBeenCalled();
    });
});
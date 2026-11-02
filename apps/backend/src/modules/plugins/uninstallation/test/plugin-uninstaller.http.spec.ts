import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    INestApplication,
    UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { PERMISSIONS_KEY } from '@/rbac/decorators/permissions.decorator';

import { PluginUninstallerController } from '../plugin-uninstaller.controller';
import { PluginUninstallerService } from '../plugin-uninstaller.service';

const PLUGIN_ID = 'tyravex.test.spanish';
const ENDPOINT = `/admin/plugins/${PLUGIN_ID}`;

interface TestUser {
    id?: number | string;
    userId?: number | string;
}

describe('PluginUninstallerController (HTTP)', () => {
    let app: INestApplication;

    const uninstall = jest.fn();

    let authenticated = true;
    let hasPermission = true;
    let user: TestUser = { id: 7 };

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

    const permissionsGuard: CanActivate = {
        canActivate(): boolean {
            if (!hasPermission) {
                throw new ForbiddenException();
            }

            return true;
        },
    };

    beforeAll(async () => {
        const moduleRef: TestingModule =
            await Test.createTestingModule({
                controllers: [
                    PluginUninstallerController,
                ],
                providers: [
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
                .overrideGuard(PermissionsGuard)
                .useValue(permissionsGuard)
                .compile();

        app = moduleRef.createNestApplication();
        await app.init();
    });

    beforeEach(() => {
        jest.clearAllMocks();

        authenticated = true;
        hasPermission = true;
        user = { id: 7 };

        uninstall.mockResolvedValue({
            id: PLUGIN_ID,
            removed: true,
            cleanupPending: false,
        });
    });

    afterAll(async () => {
        await app?.close();
    });

    it('requires the plugin:manage permission metadata', () => {
        const permissions = Reflect.getMetadata(
            PERMISSIONS_KEY,
            PluginUninstallerController,
        );

        expect(permissions).toContain('plugin:manage');
    });

    it('returns 200 for an authorized administrator', async () => {
        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

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

    it('returns 401 when authentication is missing', async () => {
        authenticated = false;

        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

        expect(response.status).toBe(401);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 403 without plugin management permission', async () => {
        hasPermission = false;

        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

        expect(response.status).toBe(403);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 400 when confirmation ID does not match', async () => {
        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: 'another.plugin',
            });

        expect(response.status).toBe(400);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 400 when confirmation ID is missing', async () => {
        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({});

        expect(response.status).toBe(400);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 400 when the request body is empty', async () => {
        const response = await request(app.getHttpServer())
            .delete(ENDPOINT);

        expect(response.status).toBe(400);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 401 when administrator identity is missing', async () => {
        user = {};

        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

        expect(response.status).toBe(401);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 401 when administrator ID is zero', async () => {
        user = { id: 0 };

        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

        expect(response.status).toBe(401);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns 401 when administrator ID is negative', async () => {
        user = { id: -7 };

        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

        expect(response.status).toBe(401);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('accepts a numeric administrator ID as a string', async () => {
        user = { id: '42' };

        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

        expect(response.status).toBe(200);
        expect(uninstall).toHaveBeenCalledWith(
            PLUGIN_ID,
            42,
        );
    });

    it('accepts userId when id is unavailable', async () => {
        user = { userId: '15' };

        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

        expect(response.status).toBe(200);
        expect(uninstall).toHaveBeenCalledWith(
            PLUGIN_ID,
            15,
        );
    });

    it('rejects a non-numeric administrator ID', async () => {
        user = { id: 'administrator' };

        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

        expect(response.status).toBe(401);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('rejects an unsafe integer administrator ID', async () => {
        user = {
            id: '9007199254740992',
        };

        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

        expect(response.status).toBe(401);
        expect(uninstall).not.toHaveBeenCalled();
    });

    it('returns cleanupPending when cleanup is incomplete', async () => {
        uninstall.mockResolvedValue({
            id: PLUGIN_ID,
            removed: true,
            cleanupPending: true,
        });

        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

        expect(response.status).toBe(200);

        expect(response.body).toEqual({
            id: PLUGIN_ID,
            removed: true,
            cleanupPending: true,
        });
    });

    it('does not call the service when both guards reject access', async () => {
        authenticated = false;
        hasPermission = false;

        const response = await request(app.getHttpServer())
            .delete(ENDPOINT)
            .send({
                confirmId: PLUGIN_ID,
            });

        expect([401, 403]).toContain(response.status);
        expect(uninstall).not.toHaveBeenCalled();
    });
});
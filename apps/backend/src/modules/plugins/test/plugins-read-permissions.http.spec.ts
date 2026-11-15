import {
    ExecutionContext,
    INestApplication,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { PluginInstallerService } from '../installation/plugin-installer.service';
import { PluginsController } from '../plugins.controller';
import { PluginsService } from '../plugins.service';

describe('Plugin read permissions HTTP', () => {
    let app: INestApplication;

    const listForAdmin = jest.fn();
    const getForAdmin = jest.fn();
    const installLanguagePackage = jest.fn();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [PluginsController],
            providers: [
                Reflector,
                PermissionsGuard,
                {
                    provide: PluginsService,
                    useValue: { listForAdmin, getForAdmin },
                },
                {
                    provide: PluginInstallerService,
                    useValue: { installLanguagePackage },
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate(context: ExecutionContext): boolean {
                    const req = context.switchToHttp().getRequest<{
                        headers: Record<string, string | string[] | undefined>;
                        user?: { id: number; permissions: string[] };
                    }>();

                    const raw = req.headers['x-test-auth'];
                    const auth = Array.isArray(raw) ? raw[0] : raw;

                    if (auth !== 'valid') {
                        throw new UnauthorizedException();
                    }

                    const rawPermission = req.headers['x-test-permission'];
                    const permission = Array.isArray(rawPermission)
                        ? rawPermission[0]
                        : rawPermission;

                    req.user = {
                        id: 7,
                        permissions: permission ? [permission] : [],
                    };

                    return true;
                },
            })
            .compile();

        app = moduleRef.createNestApplication();
        await app.init();
    });

    beforeEach(() => {
        jest.clearAllMocks();

        listForAdmin.mockResolvedValue([{ id: 'example.language' }]);
        getForAdmin.mockResolvedValue({ id: 'example.language' });
    });

    afterAll(async () => {
        await app?.close();
    });

    const authenticated = (req: request.Test, permission?: string) => {
        req.set('x-test-auth', 'valid');

        if (permission) {
            req.set('x-test-permission', permission);
        }

        return req;
    };

    describe('GET /admin/plugins', () => {
        it('returns 401 without authentication', async () => {
            await request(app.getHttpServer())
                .get('/admin/plugins')
                .expect(401);

            expect(listForAdmin).not.toHaveBeenCalled();
        });

        it('returns 403 without permissions', async () => {
            await authenticated(
                request(app.getHttpServer()).get('/admin/plugins'),
            ).expect(403);

            expect(listForAdmin).not.toHaveBeenCalled();
        });

        it('returns 403 with only plugin:manage', async () => {
            await authenticated(
                request(app.getHttpServer()).get('/admin/plugins'),
                'plugin:manage',
            ).expect(403);

            expect(listForAdmin).not.toHaveBeenCalled();
        });

        it('returns 200 with plugin:read', async () => {
            const response = await authenticated(
                request(app.getHttpServer()).get('/admin/plugins'),
                'plugin:read',
            ).expect(200);

            expect(response.body).toEqual([{ id: 'example.language' }]);
            expect(listForAdmin).toHaveBeenCalledTimes(1);
        });
    });

    describe('GET /admin/plugins/:id', () => {
        it('returns 401 without authentication', async () => {
            await request(app.getHttpServer())
                .get('/admin/plugins/example.language')
                .expect(401);

            expect(getForAdmin).not.toHaveBeenCalled();
        });

        it('returns 403 without permissions', async () => {
            await authenticated(
                request(app.getHttpServer())
                    .get('/admin/plugins/example.language'),
            ).expect(403);

            expect(getForAdmin).not.toHaveBeenCalled();
        });

        it('returns 403 with only plugin:manage', async () => {
            await authenticated(
                request(app.getHttpServer())
                    .get('/admin/plugins/example.language'),
                'plugin:manage',
            ).expect(403);

            expect(getForAdmin).not.toHaveBeenCalled();
        });

        it('returns 200 with plugin:read', async () => {
            const response = await authenticated(
                request(app.getHttpServer())
                    .get('/admin/plugins/example.language'),
                'plugin:read',
            ).expect(200);

            expect(response.body).toEqual({ id: 'example.language' });
            expect(getForAdmin).toHaveBeenCalledWith('example.language');
        });
    });

    describe('POST /admin/plugins/install', () => {
        it('returns 403 with only plugin:read', async () => {
            await authenticated(
                request(app.getHttpServer())
                    .post('/admin/plugins/install'),
                'plugin:read',
            )
                .set('Content-Type', 'application/zip')
                .send(Buffer.from('fixture'))
                .expect(403);

            expect(installLanguagePackage).not.toHaveBeenCalled();
        });
    });
});
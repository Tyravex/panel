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
import { MarketplaceController } from '../marketplace.controller';
import { MarketplaceRegistryService } from '../marketplace-registry.service';

describe('Marketplace read permission HTTP', () => {
    let app: INestApplication;

    const getOfficialRegistry = jest.fn();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [MarketplaceController],
            providers: [
                Reflector,
                PermissionsGuard,
                {
                    provide: MarketplaceRegistryService,
                    useValue: { getOfficialRegistry },
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

                    const rawAuth = req.headers['x-test-auth'];
                    const auth = Array.isArray(rawAuth)
                        ? rawAuth[0]
                        : rawAuth;

                    if (auth !== 'valid') {
                        throw new UnauthorizedException();
                    }

                    const rawPermission =
                        req.headers['x-test-permission'];

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

        app = moduleRef.createNestApplication({
            logger: false,
        });

        await app.init();
    });

    afterAll(async () => {
        await app?.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();

        getOfficialRegistry.mockResolvedValue({
            schemaVersion: 1,
            plugins: [],
        });
    });

    const authorized = (permission?: string) => {
        const req = request(app.getHttpServer())
            .get('/admin/plugins/marketplace')
            .set('x-test-auth', 'valid');

        if (permission) {
            req.set('x-test-permission', permission);
        }

        return req;
    };

    it('returns 401 without authentication', async () => {
        await request(app.getHttpServer())
            .get('/admin/plugins/marketplace')
            .expect(401);

        expect(getOfficialRegistry).not.toHaveBeenCalled();
    });

    it('returns 403 without permissions', async () => {
        await authorized().expect(403);

        expect(getOfficialRegistry).not.toHaveBeenCalled();
    });

    it('returns 403 with only plugin:manage', async () => {
        await authorized('plugin:manage').expect(403);

        expect(getOfficialRegistry).not.toHaveBeenCalled();
    });

    it('returns 200 with plugin:read', async () => {
        const response = await authorized('plugin:read')
            .expect(200);

        expect(response.body).toEqual({
            schemaVersion: 1,
            plugins: [],
        });

        expect(getOfficialRegistry).toHaveBeenCalledTimes(1);
        expect(response.headers['cache-control']).toBe('no-store');
    });
});
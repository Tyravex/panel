import 'reflect-metadata';

import {
    CanActivate,
    ExecutionContext,
    INestApplication,
    ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

import { MarketplaceRepositoriesController } from '../marketplace-repositories.controller';
import { MarketplaceRepositoriesService } from '../marketplace-repositories.service';

describe('MarketplaceRepositoriesController HTTP', () => {
    let app: INestApplication;

    const repository = {
        id: 'repo-1',
        name: 'Community Plugins',
        url: 'https://plugins.example.org/registry.json',
        isOfficial: false,
        status: 'DISABLED',
        createdAt: '2026-11-01T12:00:00.000Z',
        updatedAt: '2026-11-01T12:00:00.000Z',
    };

    const repositoriesService = {
        list: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    };

    class TestJwtAuthGuard implements CanActivate {
        canActivate(context: ExecutionContext): boolean {
            const req = context.switchToHttp().getRequest<{
                headers: Record<string, string | undefined>;
                user?: { permissions: string[] };
            }>();

            const authorization = req.headers.authorization;

            if (!authorization) {
                return false;
            }

            if (authorization === 'Bearer admin-test') {
                req.user = {
                    permissions: ['plugin:manage'],
                };
                return true;
            }

            if (authorization === 'Bearer user-test') {
                req.user = {
                    permissions: [],
                };
                return true;
            }

            return false;
        }
    }

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [MarketplaceRepositoriesController],
            providers: [
                Reflector,
                PermissionsGuard,
                {
                    provide: MarketplaceRepositoriesService,
                    useValue: repositoriesService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useClass(TestJwtAuthGuard)
            .compile();

        app = moduleRef.createNestApplication();

        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );

        await app.init();
    });

    beforeEach(() => {
        jest.clearAllMocks();

        repositoriesService.list.mockResolvedValue({
            repositories: [repository],
        });

        repositoriesService.create.mockResolvedValue(repository);

        repositoriesService.update.mockResolvedValue({
            ...repository,
            status: 'ENABLED',
        });
    });

    afterAll(async () => {
        await app?.close();
    });

    it('rejects unauthenticated requests', async () => {
        await request(app.getHttpServer())
            .get('/admin/plugins/marketplace/repositories')
            .expect(403);

        expect(repositoriesService.list).not.toHaveBeenCalled();
    });

    it('rejects authenticated users without plugin:manage', async () => {
        await request(app.getHttpServer())
            .get('/admin/plugins/marketplace/repositories')
            .set('Authorization', 'Bearer user-test')
            .expect(403);

        expect(repositoriesService.list).not.toHaveBeenCalled();
    });

    it('lists repositories for an authorized administrator', async () => {
        const response = await request(app.getHttpServer())
            .get('/admin/plugins/marketplace/repositories')
            .set('Authorization', 'Bearer admin-test')
            .expect(200);

        expect(response.body).toEqual({
            repositories: [repository],
        });
    });

    it('creates a repository', async () => {
        await request(app.getHttpServer())
            .post('/admin/plugins/marketplace/repositories')
            .set('Authorization', 'Bearer admin-test')
            .send({
                name: 'Community Plugins',
                url: 'https://plugins.example.org/registry.json',
            })
            .expect(201);

        expect(repositoriesService.create).toHaveBeenCalledWith({
            name: 'Community Plugins',
            url: 'https://plugins.example.org/registry.json',
        });
    });

    it('rejects invalid repository URLs', async () => {
        await request(app.getHttpServer())
            .post('/admin/plugins/marketplace/repositories')
            .set('Authorization', 'Bearer admin-test')
            .send({
                name: 'Unsafe Repository',
                url: 'http://plugins.example.org/registry.json',
            })
            .expect(400);

        expect(repositoriesService.create).not.toHaveBeenCalled();
    });

    it('rejects unknown DTO fields', async () => {
        await request(app.getHttpServer())
            .post('/admin/plugins/marketplace/repositories')
            .set('Authorization', 'Bearer admin-test')
            .send({
                name: 'Community Plugins',
                url: 'https://plugins.example.org/registry.json',
                isOfficial: true,
            })
            .expect(400);

        expect(repositoriesService.create).not.toHaveBeenCalled();
    });

    it('updates repository status', async () => {
        const response = await request(app.getHttpServer())
            .patch('/admin/plugins/marketplace/repositories/repo-1')
            .set('Authorization', 'Bearer admin-test')
            .send({ status: 'ENABLED' })
            .expect(200);

        expect(response.body.status).toBe('ENABLED');

        expect(repositoriesService.update).toHaveBeenCalledWith(
            'repo-1',
            { status: 'ENABLED' },
        );
    });
    it('rejects invalid repository status', async () => {
        await request(app.getHttpServer())
            .patch('/admin/plugins/marketplace/repositories/repo-1')
            .set('Authorization', 'Bearer admin-test')
            .send({ status: 'UNKNOWN' })
            .expect(400);

        expect(repositoriesService.update).not.toHaveBeenCalled();
    });
});
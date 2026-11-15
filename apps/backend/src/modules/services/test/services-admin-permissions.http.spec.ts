import {
    ExecutionContext,
    INestApplication,
    UnauthorizedException,
    ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { ServicesController } from '../services.controller';
import { ServicesService } from '../services.service';

describe('Services administration RBAC v2 HTTP', () => {
    let app: INestApplication;

    const getAllServices = jest.fn();
    const createService = jest.fn();
    const setOwner = jest.fn();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [ServicesController],
            providers: [
                {
                    provide: ServicesService,
                    useValue: {
                        getAllServices,
                        createService,
                        setOwner,
                    },
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate(context: ExecutionContext): boolean {
                    const req = context.switchToHttp().getRequest<{
                        headers: Record<
                            string,
                            string | string[] | undefined
                        >;
                        user?: {
                            id: number;
                            roles: string[];
                            permissions: string[];
                        };
                    }>();

                    const first = (
                        value: string | string[] | undefined,
                    ): string | undefined =>
                        Array.isArray(value) ? value[0] : value;

                    if (first(req.headers['x-test-auth']) !== 'valid') {
                        throw new UnauthorizedException();
                    }

                    const permission = first(
                        req.headers['x-test-permission'],
                    );

                    const role = first(req.headers['x-test-role']);

                    req.user = {
                        id: 7,
                        roles: [role ?? 'User'],
                        permissions: permission ? [permission] : [],
                    };

                    return true;
                },
            })
            .compile();

        app = moduleRef.createNestApplication();

        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                transform: true,
            }),
        );

        await app.init();
    });

    beforeEach(() => {
        jest.clearAllMocks();

        getAllServices.mockResolvedValue([
            { id: 'svc-1', name: 'Example' },
        ]);

        createService.mockResolvedValue({
            id: 'svc-new',
            name: 'Example',
        });

        setOwner.mockResolvedValue({
            id: 'svc-1',
            userId: null,
        });
    });

    afterAll(async () => {
        await app?.close();
    });

    const authenticated = (
        req: request.Test,
        permission?: string,
        role = 'User',
    ) => {
        req.set('x-test-auth', 'valid');
        req.set('x-test-role', role);

        if (permission) {
            req.set('x-test-permission', permission);
        }

        return req;
    };

    const createDto = {
        name: 'Example',
        categoryKey: 'server',
        userId: null,
    };

    const transferDto = { userId: null };

    describe('GET /services/admin/all', () => {
        it('returns 401 without authentication', async () => {
            await request(app.getHttpServer())
                .get('/services/admin/all')
                .expect(401);

            expect(getAllServices).not.toHaveBeenCalled();
        });

        it('returns 403 without permissions', async () => {
            await authenticated(
                request(app.getHttpServer())
                    .get('/services/admin/all'),
            ).expect(403);

            expect(getAllServices).not.toHaveBeenCalled();
        });

        it('returns 403 with only service:manage:any', async () => {
            await authenticated(
                request(app.getHttpServer())
                    .get('/services/admin/all'),
                'service:manage:any',
                'Owner',
            ).expect(403);

            expect(getAllServices).not.toHaveBeenCalled();
        });

        it('returns 200 with service:read:any', async () => {
            const response = await authenticated(
                request(app.getHttpServer())
                    .get('/services/admin/all'),
                'service:read:any',
                'Moderator',
            ).expect(200);

            expect(response.body).toEqual([
                { id: 'svc-1', name: 'Example' },
            ]);

            expect(getAllServices).toHaveBeenCalledTimes(1);
        });
    });

    describe('POST /services', () => {
        it('returns 401 without authentication', async () => {
            await request(app.getHttpServer())
                .post('/services')
                .send(createDto)
                .expect(401);

            expect(createService).not.toHaveBeenCalled();
        });

        it('returns 403 without permissions', async () => {
            await authenticated(
                request(app.getHttpServer()).post('/services'),
            )
                .send(createDto)
                .expect(403);

            expect(createService).not.toHaveBeenCalled();
        });

        it('returns 403 with legacy server:create', async () => {
            await authenticated(
                request(app.getHttpServer()).post('/services'),
                'server:create',
                'Owner',
            )
                .send(createDto)
                .expect(403);

            expect(createService).not.toHaveBeenCalled();
        });

        it('returns 201 with service:create', async () => {
            const response = await authenticated(
                request(app.getHttpServer()).post('/services'),
                'service:create',
                'Administrator',
            )
                .send(createDto)
                .expect(201);

            expect(response.body).toEqual({
                id: 'svc-new',
                name: 'Example',
            });

            expect(createService).toHaveBeenCalledWith(
                7,
                createDto,
            );
        });
    });

    describe('PATCH /services/:id/owner', () => {
        it('returns 401 without authentication', async () => {
            await request(app.getHttpServer())
                .patch('/services/svc-1/owner')
                .send(transferDto)
                .expect(401);

            expect(setOwner).not.toHaveBeenCalled();
        });

        it('returns 403 without permissions', async () => {
            await authenticated(
                request(app.getHttpServer())
                    .patch('/services/svc-1/owner'),
            )
                .send(transferDto)
                .expect(403);

            expect(setOwner).not.toHaveBeenCalled();
        });

        it('returns 403 with only service:manage:any', async () => {
            await authenticated(
                request(app.getHttpServer())
                    .patch('/services/svc-1/owner'),
                'service:manage:any',
                'Owner',
            )
                .send(transferDto)
                .expect(403);

            expect(setOwner).not.toHaveBeenCalled();
        });

        it('returns 200 with service:transfer:any', async () => {
            const response = await authenticated(
                request(app.getHttpServer())
                    .patch('/services/svc-1/owner'),
                'service:transfer:any',
                'CustomRole',
            )
                .send(transferDto)
                .expect(200);

            expect(response.body).toEqual({
                id: 'svc-1',
                userId: null,
            });

            expect(setOwner).toHaveBeenCalledWith(
                'svc-1',
                7,
                transferDto,
            );
        });
    });

    describe('validation boundaries', () => {
        it('rejects invalid creation data before service call', async () => {
            await authenticated(
                request(app.getHttpServer()).post('/services'),
                'service:create',
            )
                .send({ name: '', categoryKey: 'server' })
                .expect(400);

            expect(createService).not.toHaveBeenCalled();
        });

        it('rejects invalid owner IDs before service call', async () => {
            await authenticated(
                request(app.getHttpServer())
                    .patch('/services/svc-1/owner'),
                'service:transfer:any',
            )
                .send({ userId: -1 })
                .expect(400);

            expect(setOwner).not.toHaveBeenCalled();
        });
    });
});

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';

import { RbacController } from '../rbac.controller';
import { RbacService } from '../rbac.service';
import { DefaultRoleService } from '../default-role.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';

describe('Default role HTTP authorization and validation', () => {
    let app: INestApplication;

    const actorId = 42;
    let authenticated = true;
    let permissions: string[] = [];

    const getDefaultRole = jest.fn();
    const listEligibleDefaultRoles = jest.fn();
    const setDefaultRole = jest.fn();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [RbacController],
            providers: [
                Reflector,
                PermissionsGuard,
                {
                    provide: RbacService,
                    useValue: {},
                },
                {
                    provide: DefaultRoleService,
                    useValue: {
                        getDefaultRole,
                        listEligibleDefaultRoles,
                        setDefaultRole,
                    },
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (context: {
                    switchToHttp: () => {
                        getRequest: () => {
                            user?: { id: number; permissions: string[] };
                        };
                    };
                }) => {
                    if (!authenticated) return false;

                    const req = context.switchToHttp().getRequest();
                    req.user = { id: actorId, permissions };

                    return true;
                },
            })
            .compile();

        app = moduleRef.createNestApplication();
        await app.init();
    });

    beforeEach(() => {
        jest.resetAllMocks();

        authenticated = true;
        permissions = [];

        getDefaultRole.mockResolvedValue({
            id: 'role-user',
            name: 'User',
        });

        listEligibleDefaultRoles.mockResolvedValue([
            { id: 'role-user', name: 'User' },
        ]);

        setDefaultRole.mockResolvedValue({
            id: 'role-user',
            name: 'User',
        });
    });

    afterAll(async () => {
        await app?.close();
    });

    it('rejects unauthenticated GET requests', async () => {
        authenticated = false;

        await request(app.getHttpServer())
            .get('/admin/rbac/default-role')
            .expect(403);

        expect(getDefaultRole).not.toHaveBeenCalled();
    });

    it('rejects GET without settings:read', async () => {
        permissions = ['role:manage'];

        await request(app.getHttpServer())
            .get('/admin/rbac/default-role')
            .expect(403);

        expect(getDefaultRole).not.toHaveBeenCalled();
    });

    it('allows GET with settings:read without role:manage', async () => {
        permissions = ['settings:read'];

        await request(app.getHttpServer())
            .get('/admin/rbac/default-role')
            .expect(200, {
                id: 'role-user',
                name: 'User',
            });

        expect(getDefaultRole).toHaveBeenCalledTimes(1);
    });

    it('allows eligible roles GET with settings:read', async () => {
        permissions = ['settings:read'];

        await request(app.getHttpServer())
            .get('/admin/rbac/default-role/eligible')
            .expect(200, [
                { id: 'role-user', name: 'User' },
            ]);

        expect(listEligibleDefaultRoles).toHaveBeenCalledTimes(1);
    });

    it('rejects eligible roles GET without settings:read', async () => {
        permissions = ['settings:manage'];

        await request(app.getHttpServer())
            .get('/admin/rbac/default-role/eligible')
            .expect(403);

        expect(listEligibleDefaultRoles).not.toHaveBeenCalled();
    });

    it('rejects PATCH without settings:manage', async () => {
        permissions = ['settings:read', 'role:manage'];

        await request(app.getHttpServer())
            .patch('/admin/rbac/default-role')
            .send({ roleId: 'role-user' })
            .expect(403);

        expect(setDefaultRole).not.toHaveBeenCalled();
    });

    it('allows PATCH with settings:manage without role:manage', async () => {
        permissions = ['settings:manage'];

        await request(app.getHttpServer())
            .patch('/admin/rbac/default-role')
            .send({ roleId: 'role-user' })
            .expect(200, {
                id: 'role-user',
                name: 'User',
            });

        expect(setDefaultRole).toHaveBeenCalledWith(
            'role-user',
            actorId,
        );
    });

    it.each([
        ['missing field', {}],
        ['extra field', { roleId: 'role-user', permissions: ['role:manage'] }],
        ['null', { roleId: null }],
        ['number', { roleId: 123 }],
        ['empty string', { roleId: '' }],
        ['whitespace', { roleId: '   ' }],
        ['array', ['role-user']],
    ])('rejects invalid PATCH body: %s', async (_label, body) => {
        permissions = ['settings:manage'];

        await request(app.getHttpServer())
            .patch('/admin/rbac/default-role')
            .send(body)
            .expect(400);

        expect(setDefaultRole).not.toHaveBeenCalled();
    });

    it('does not expose default role mutation through GET', async () => {
        permissions = ['settings:read'];

        await request(app.getHttpServer())
            .get('/admin/rbac/default-role')
            .expect(200);

        expect(setDefaultRole).not.toHaveBeenCalled();
    });
});

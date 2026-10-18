import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RbacController } from '../rbac.controller';
import { RbacService } from '../rbac.service';
import { PermissionsGuard } from '../guards/permissions.guard';

describe('RBAC HTTP parameter validation', () => {
    let app: INestApplication;
    const listUserRoles = jest.fn();
    const assignRole = jest.fn();
    const revokeRole = jest.fn();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [RbacController],
            providers: [
                {
                    provide: RbacService,
                    useValue: { listUserRoles, assignRole, revokeRole },
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(PermissionsGuard)
            .useValue({ canActivate: () => true })
            .compile();

        app = moduleRef.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app?.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it.each(['abc', '1.5', '-not-an-id', '2147483648x'])(
        'rejects malformed user ID %s on role listing before reaching the service',
        async (userId) => {
            await request(app.getHttpServer())
                .get(`/admin/rbac/users/${userId}/roles`)
                .expect(400);

            expect(listUserRoles).not.toHaveBeenCalled();
        },
    );

    it.each(['abc', '1.5', '-not-an-id'])(
        'rejects malformed user ID %s on role assignment before reaching the service',
        async (userId) => {
            await request(app.getHttpServer())
                .post(`/admin/rbac/users/${userId}/roles/example-role`)
                .expect(400);

            expect(assignRole).not.toHaveBeenCalled();
        },
    );

    it.each(['abc', '1.5', '-not-an-id'])(
        'rejects malformed user ID %s on role revocation before reaching the service',
        async (userId) => {
            await request(app.getHttpServer())
                .delete(`/admin/rbac/users/${userId}/roles/example-role`)
                .expect(400);

            expect(revokeRole).not.toHaveBeenCalled();
        },
    );

    it('converts a valid user ID to a number for role listing', async () => {
        listUserRoles.mockResolvedValue([]);

        await request(app.getHttpServer())
            .get('/admin/rbac/users/42/roles')
            .expect(200);

        expect(listUserRoles).toHaveBeenCalledWith(42);
    });
});

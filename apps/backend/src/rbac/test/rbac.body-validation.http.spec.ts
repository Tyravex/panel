import { BadRequestException, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RbacController } from '../rbac.controller';
import { RbacService } from '../rbac.service';

const allowAdmin = {
    canActivate: (context: ExecutionContext) => {
        context.switchToHttp().getRequest().user = { id: 7 };
        return true;
    },
};

describe('RBAC HTTP body validation characterization', () => {
    let app: INestApplication;
    const createRole = jest.fn();
    const updateRole = jest.fn();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [RbacController],
            providers: [{ provide: RbacService, useValue: { createRole, updateRole } }],
        })
            .overrideGuard(JwtAuthGuard).useValue(allowAdmin)
            .overrideGuard(PermissionsGuard).useValue(allowAdmin)
            .compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }));
        await app.init();
    });

    afterAll(async () => { await app?.close(); });

    beforeEach(() => {
        jest.resetAllMocks();
        createRole.mockResolvedValue({ id: 'role-1' });
        updateRole.mockResolvedValue({ id: 'role-1' });
    });

    it.each([
        ['empty body', {}],
        ['invalid field types', { name: 123, permissionIds: 'not-an-array' }],
        ['extra field', { name: 'Support', permissionIds: [], isOwner: true }],
        ['reserved role name', { name: 'Owner', permissionIds: [] }],
    ])('passes %s to the create service despite the global ValidationPipe', async (_label, body) => {
        await request(app.getHttpServer())
            .post('/admin/rbac/roles').send(body).expect(201);
        expect(createRole).toHaveBeenCalledWith(body, 7);
    });

    it.each([
        ['empty body', {}],
        ['invalid field types', { name: false, permissionIds: [123] }],
        ['extra field', { name: 'Support', permissionIds: [], isOwner: true }],
    ])('passes %s to the update service despite the global ValidationPipe', async (_label, body) => {
        await request(app.getHttpServer())
            .patch('/admin/rbac/roles/role-1').send(body).expect(200);
        expect(updateRole).toHaveBeenCalledWith('role-1', body, 7);
    });

    it('returns a service-level validation error as HTTP 400 on create', async () => {
        createRole.mockRejectedValue(new BadRequestException('Invalid permission IDs'));
        await request(app.getHttpServer())
            .post('/admin/rbac/roles')
            .send({ name: 'Support', permissionIds: 'invalid' })
            .expect(400);
        expect(createRole).toHaveBeenCalledTimes(1);
    });

    it('returns a service-level validation error as HTTP 400 on update', async () => {
        updateRole.mockRejectedValue(new BadRequestException('Invalid role input'));
        await request(app.getHttpServer())
            .patch('/admin/rbac/roles/role-1')
            .send({ name: 123 })
            .expect(400);
        expect(updateRole).toHaveBeenCalledTimes(1);
    });
});

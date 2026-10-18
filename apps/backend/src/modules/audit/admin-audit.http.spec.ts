import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request from 'supertest';

import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditService } from './admin-audit.service';

describe('AdminAuditController HTTP permissions', () => {
    let app: INestApplication;
    const originalSecret = process.env.JWT_SECRET;
    const list = jest.fn();
    const findUnique = jest.fn();
    const sessionFindUnique = jest.fn();

    const tokenFor = (permissions: string[], isActive = true) => {
        findUnique.mockResolvedValue({
            id: 7, username: 'staff-user', email: 'staff@example.invalid',
            avatar: null, language: 'en', isActive,
            createdAt: new Date(), updatedAt: new Date(),
            roles: [{ role: { name: 'Staff', permissions: permissions.map((name) => ({ name })) } }],
        });
        sessionFindUnique.mockResolvedValue({
            id: 'audit-test-session', userId: 7, revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
        });
        return sign(
            { sub: 7, email: 'staff@example.invalid', sid: 'audit-test-session', tokenType: 'access' },
            process.env.JWT_SECRET!,
            { expiresIn: '1h' },
        );
    };

    beforeAll(async () => {
        process.env.JWT_SECRET = 'tyravex-admin-audit-http-test-secret';
        const moduleRef = await Test.createTestingModule({
            controllers: [AdminAuditController],
            providers: [
                { provide: AdminAuditService, useValue: { list } },
                {
                    provide: PrismaService, useValue: {
                        user: { findUnique }, session: { findUnique: sessionFindUnique },
                    }
                },
                JwtStrategy,
                PermissionsGuard,
            ],
        }).compile();
        app = moduleRef.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app?.close();
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });

    beforeEach(() => {
        jest.resetAllMocks();
        list.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, pages: 0 });
    });

    it('returns 401 without a JWT', async () => {
        await request(app.getHttpServer()).get('/admin/audit').expect(401);
        expect(list).not.toHaveBeenCalled();
    });

    it('returns 403 without role:manage', async () => {
        const token = tokenFor(['user:read']);
        await request(app.getHttpServer()).get('/admin/audit')
            .set('Authorization', `Bearer ${token}`).expect(403);
        expect(list).not.toHaveBeenCalled();
    });

    it('returns 200 for role:manage and forwards query filters', async () => {
        const token = tokenFor(['role:manage']);
        const response = await request(app.getHttpServer())
            .get('/admin/audit?page=2&action=ROLE_UPDATED&actorId=7')
            .set('Authorization', `Bearer ${token}`).expect(200);
        expect(response.body).toEqual({ items: [], total: 0, page: 1, limit: 20, pages: 0 });
        expect(list).toHaveBeenCalledWith('2', 'ROLE_UPDATED', '7');
    });

    it('returns 401 for a disabled account', async () => {
        const token = tokenFor(['role:manage'], false);
        await request(app.getHttpServer()).get('/admin/audit')
            .set('Authorization', `Bearer ${token}`).expect(401);
        expect(list).not.toHaveBeenCalled();
    });

    it('returns 401 for a revoked session', async () => {
        const token = tokenFor(['role:manage']);
        sessionFindUnique.mockResolvedValue({
            id: 'audit-test-session', userId: 7, revokedAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
        });
        await request(app.getHttpServer()).get('/admin/audit')
            .set('Authorization', `Bearer ${token}`).expect(401);
        expect(list).not.toHaveBeenCalled();
    });
});

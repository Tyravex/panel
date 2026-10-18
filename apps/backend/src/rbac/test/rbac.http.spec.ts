import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { RbacController } from '../rbac.controller';
import { RbacService } from '../rbac.service';
import { PermissionsGuard } from '../guards/permissions.guard';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { PrismaService } from '@/prisma/prisma.service';
import { sign } from 'jsonwebtoken';

describe('RbacController HTTP security', () => {
    let app: INestApplication;
    const revokeRole = jest.fn();
    const findUnique = jest.fn();
    const sessionFindUnique = jest.fn();

    const originalJwtSecret = process.env.JWT_SECRET;

    beforeAll(async () => {
        // Use a test-only secret without relying on production configuration.
        process.env.JWT_SECRET = 'tyravex-rbac-http-test-secret-only';

        const moduleRef = await Test.createTestingModule({
            controllers: [RbacController],
            providers: [
                {
                    provide: RbacService,
                    useValue: { revokeRole },
                },
                {
                    provide: PrismaService,
                    useValue: {
                        user: {
                            findUnique,
                        },
                        session: {
                            findUnique: sessionFindUnique,
                        },
                    },
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

        if (originalJwtSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = originalJwtSecret;
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 when JWT is missing', async () => {
        await request(app.getHttpServer())
            .delete('/admin/rbac/users/1/roles/test-role')
            .expect(401);

        expect(revokeRole).not.toHaveBeenCalled();
    });
    it('returns 403 for a valid JWT without role:manage', async () => {
        findUnique.mockResolvedValue({
            id: 2,
            username: 'regular-user',
            email: 'regular@example.invalid',
            isActive: true,
            avatar: null,
            language: 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
            roles: [
                {
                    role: {
                        name: 'User',
                        permissions: [],
                    },
                },
            ],
        });

        sessionFindUnique.mockResolvedValue({
            id: 'rbac-session-2',
            userId: 2,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
        });

        const token = sign(
            {
                sub: 2,
                email: 'regular@example.invalid',
                sid: 'rbac-session-2',
                tokenType: 'access',
            },
            process.env.JWT_SECRET!,
            { expiresIn: '1h' },
        );

        await request(app.getHttpServer())
            .delete('/admin/rbac/users/1/roles/test-role')
            .set('Authorization', `Bearer ${token}`)
            .expect(403);

        expect(findUnique).toHaveBeenCalledWith({
            where: { id: 2 },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: true,
                            },
                        },
                    },
                },
            },
        });

        expect(revokeRole).not.toHaveBeenCalled();
    });
    it('allows role revocation with role:manage permission', async () => {
        findUnique.mockResolvedValue({
            id: 3,
            username: 'staff-user',
            email: 'staff@example.invalid',
            isActive: true,
            avatar: null,
            language: 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
            roles: [
                {
                    role: {
                        name: 'Support',
                        permissions: [
                            { name: 'role:manage' },
                        ],
                    },
                },
            ],
        });

        revokeRole.mockResolvedValue(undefined);

        sessionFindUnique.mockResolvedValue({
            id: 'rbac-session-3',
            userId: 3,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
        });

        const token = sign(
            {
                sub: 3,
                email: 'staff@example.invalid',
                sid: 'rbac-session-3',
                tokenType: 'access',
            },
            process.env.JWT_SECRET!,
            { expiresIn: '1h' },
        );

        await request(app.getHttpServer())
            .delete('/admin/rbac/users/2/roles/test-role')
            .set('Authorization', `Bearer ${token}`)
            .expect(204);

        expect(revokeRole).toHaveBeenCalledWith(2, 'test-role', 3);
        expect(revokeRole).toHaveBeenCalledTimes(1);
    });
});
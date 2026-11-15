import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import request from 'supertest';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';

import { AdminAuditController } from '@/modules/audit/admin-audit.controller';
import { AdminAuditService } from '@/modules/audit/admin-audit.service';
import { LocationsController } from '@/modules/locations/locations.controller';
import { LocationsService } from '@/modules/locations/locations.service';
import { RegionsController } from '@/modules/regions/regions.controller';
import { RegionsService } from '@/modules/regions/regions.service';

describe('RBAC v2 endpoint permissions HTTP', () => {
  let app: INestApplication;

  const auditList = jest.fn();
  const locationsFindAll = jest.fn();
  const regionsFindAll = jest.fn();

  const endpoints = [
    {
      path: '/admin/audit',
      oldPermission: 'role:manage',
      newPermission: 'audit:read',
      service: auditList,
    },
    {
      path: '/locations',
      oldPermission: 'node:manage',
      newPermission: 'location:manage',
      service: locationsFindAll,
    },
    {
      path: '/regions',
      oldPermission: 'node:manage',
      newPermission: 'region:manage',
      service: regionsFindAll,
    },
  ];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        AdminAuditController,
        LocationsController,
        RegionsController,
      ],
      providers: [
        Reflector,
        PermissionsGuard,
        {
          provide: AdminAuditService,
          useValue: { list: auditList },
        },
        {
          provide: LocationsService,
          useValue: { findAll: locationsFindAll },
        },
        {
          provide: RegionsService,
          useValue: { findAll: regionsFindAll },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext): boolean {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string | string[] | undefined>;
            user?: {
              id: number;
              permissions: string[];
            };
          }>();

          if (req.headers['x-test-auth'] !== 'authenticated') {
            throw new UnauthorizedException();
          }

          const rawPermissions = req.headers['x-test-permissions'];
          const value = Array.isArray(rawPermissions)
            ? rawPermissions[0]
            : rawPermissions;

          req.user = {
            id: 7,
            permissions: value ? value.split(',') : [],
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

    auditList.mockResolvedValue({ items: [], total: 0 });
    locationsFindAll.mockResolvedValue([]);
    regionsFindAll.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app?.close();
  });

  for (const endpoint of endpoints) {
    describe(`GET ${endpoint.path}`, () => {
      it('returns 401 without authentication', async () => {
        await request(app.getHttpServer())
          .get(endpoint.path)
          .expect(401);

        expect(endpoint.service).not.toHaveBeenCalled();
      });

      it('returns 403 without permissions', async () => {
        await request(app.getHttpServer())
          .get(endpoint.path)
          .set('x-test-auth', 'authenticated')
          .expect(403);

        expect(endpoint.service).not.toHaveBeenCalled();
      });

      it(`returns 403 with old permission ${endpoint.oldPermission}`, async () => {
        await request(app.getHttpServer())
          .get(endpoint.path)
          .set('x-test-auth', 'authenticated')
          .set('x-test-permissions', endpoint.oldPermission)
          .expect(403);

        expect(endpoint.service).not.toHaveBeenCalled();
      });

      it(`returns 200 with ${endpoint.newPermission}`, async () => {
        await request(app.getHttpServer())
          .get(endpoint.path)
          .set('x-test-auth', 'authenticated')
          .set('x-test-permissions', endpoint.newPermission)
          .expect(200);

        expect(endpoint.service).toHaveBeenCalledTimes(1);
      });
    });
  }
});
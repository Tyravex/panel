import {
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { AdminUsersController } from '@/modules/users/admin-users.controller';
import { AdminUsersService } from '@/modules/users/admin-users.service';
import { DefaultRoleService } from '../default-role.service';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RbacController } from '../rbac.controller';
import { RbacService } from '../rbac.service';

describe('RBAC v2 granular endpoint permissions HTTP', () => {
  let app: INestApplication;

  const listPermissions = jest.fn();
  const listRoles = jest.fn();
  const listUserRoles = jest.fn();
  const assignRole = jest.fn();
  const revokeRole = jest.fn();
  const createUser = jest.fn();

  const endpoints = [
    {
      method: 'GET',
      path: '/admin/rbac/permissions',
      required: 'role:read',
      old: 'role:manage',
      status: 200,
      service: listPermissions,
    },
    {
      method: 'GET',
      path: '/admin/rbac/roles',
      required: 'role:read',
      old: 'role:manage',
      status: 200,
      service: listRoles,
    },
    {
      method: 'GET',
      path: '/admin/rbac/users/9/roles',
      required: 'role:read',
      old: 'role:manage',
      status: 200,
      service: listUserRoles,
    },
    {
      method: 'POST',
      path: '/admin/rbac/users/9/roles/example-role',
      required: 'role:assign',
      old: 'role:manage',
      status: 204,
      service: assignRole,
    },
    {
      method: 'DELETE',
      path: '/admin/rbac/users/9/roles/example-role',
      required: 'role:assign',
      old: 'role:manage',
      status: 204,
      service: revokeRole,
    },
    {
      method: 'POST',
      path: '/admin/users',
      required: 'user:create',
      old: 'user:manage',
      status: 201,
      service: createUser,
    },
  ] as const;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RbacController, AdminUsersController],
      providers: [
        Reflector,
        PermissionsGuard,
        {
          provide: RbacService,
          useValue: {
            listPermissions,
            listRoles,
            listUserRoles,
            assignRole,
            revokeRole,
          },
        },
        {
          provide: DefaultRoleService,
          useValue: {},
        },
        {
          provide: AdminUsersService,
          useValue: {
            create: createUser,
          },
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

          if (req.headers['x-test-auth'] !== 'authenticated') {
            throw new UnauthorizedException();
          }

          const raw = req.headers['x-test-permissions'];
          const value = Array.isArray(raw) ? raw[0] : raw;

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

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    listPermissions.mockResolvedValue([]);
    listRoles.mockResolvedValue([]);
    listUserRoles.mockResolvedValue([]);
    assignRole.mockResolvedValue(undefined);
    revokeRole.mockResolvedValue(undefined);
    createUser.mockResolvedValue({ id: 9 });
  });

  const call = (
    endpoint: (typeof endpoints)[number],
    permissions?: string,
    authenticated = true,
  ) => {
    const http = request(app.getHttpServer());

    const req =
      endpoint.method === 'GET'
        ? http.get(endpoint.path)
        : endpoint.method === 'DELETE'
          ? http.delete(endpoint.path)
          : http.post(endpoint.path);

    if (authenticated) {
      req.set('x-test-auth', 'authenticated');
    }

    if (permissions) {
      req.set('x-test-permissions', permissions);
    }

    if (endpoint.path === '/admin/users') {
      req.send({
        username: 'new-user',
        email: 'new@example.invalid',
        password: 'a-long-password',
      });
    }

    return req;
  };

  for (const endpoint of endpoints) {
    describe(`${endpoint.method} ${endpoint.path}`, () => {
      it('returns 401 without authentication', async () => {
        await call(endpoint, undefined, false).expect(401);

        expect(endpoint.service).not.toHaveBeenCalled();
      });

      it('returns 403 without the required permission', async () => {
        await call(endpoint).expect(403);

        expect(endpoint.service).not.toHaveBeenCalled();
      });

      it(`allows ${endpoint.required} without ${endpoint.old}`, async () => {
        await call(endpoint, endpoint.required).expect(endpoint.status);

        expect(endpoint.service).toHaveBeenCalledTimes(1);
      });

      it(`rejects ${endpoint.old} without ${endpoint.required}`, async () => {
        await call(endpoint, endpoint.old).expect(403);

        expect(endpoint.service).not.toHaveBeenCalled();
      });
    });
  }
});
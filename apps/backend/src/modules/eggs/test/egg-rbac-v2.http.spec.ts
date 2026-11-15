import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EggLibraryController } from '../egg-library.controller';
import { EggsController, EggStatusController } from '../eggs.controller';
import { EggsService } from '../eggs.service';

describe('Egg administration RBAC v2 HTTP permissions', () => {
  let app: INestApplication;
  let authenticatedUser: Record<string, unknown> | null;

  const eggsService = {
    listLibraryEggs: jest.fn(),
    getLibraryStats: jest.fn(),
    getLibraryEgg: jest.fn(),
    listRepositories: jest.fn(),
    listEggs: jest.fn(),
    createRepository: jest.fn(),
    importEgg: jest.fn(),
    setRepositoryStatus: jest.fn(),
    setEggStatus: jest.fn(),
    setEggApproval: jest.fn(),
    createCustomEgg: jest.fn(),
    listMyEggs: jest.fn(),
  };

  const asUser = (roles: string[], permissions: string[]) => {
    authenticatedUser = { id: 42, roles, permissions };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        EggLibraryController,
        EggsController,
        EggStatusController,
      ],
      providers: [{ provide: EggsService, useValue: eggsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user?: unknown } };
        }) => {
          if (!authenticatedUser) return false;
          context.switchToHttp().getRequest().user = authenticatedUser;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    asUser(['User'], []);

    eggsService.listLibraryEggs.mockResolvedValue([]);
    eggsService.getLibraryStats.mockResolvedValue({
      total: 0,
      enabled: 0,
      disabled: 0,
    });
    eggsService.getLibraryEgg.mockResolvedValue({ id: 'egg-1' });
    eggsService.listRepositories.mockResolvedValue([]);
    eggsService.listEggs.mockResolvedValue([]);
    eggsService.createRepository.mockResolvedValue({ id: 'repo-1' });
    eggsService.importEgg.mockResolvedValue({ id: 'egg-1' });
    eggsService.setRepositoryStatus.mockResolvedValue({
      id: 'repo-1',
      status: 'ENABLED',
    });
    eggsService.setEggStatus.mockResolvedValue({
      id: 'egg-1',
      isEnabled: true,
    });
    eggsService.setEggApproval.mockResolvedValue({
      id: 'egg-1',
      approvalStatus: 'APPROVED',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const readRoutes = [
    {
      name: 'library list',
      path: '/eggs/library',
      service: 'listLibraryEggs',
    },
    {
      name: 'library stats',
      path: '/eggs/library/stats',
      service: 'getLibraryStats',
    },
    {
      name: 'library details',
      path: '/eggs/library/egg-1',
      service: 'getLibraryEgg',
    },
    {
      name: 'repository list',
      path: '/egg-repositories',
      service: 'listRepositories',
    },
    {
      name: 'repository Eggs',
      path: '/egg-repositories/repo-1/eggs',
      service: 'listEggs',
    },
  ] as const;

  const writeRoutes = [
    {
      name: 'create repository',
      method: 'post',
      path: '/egg-repositories',
      body: { name: 'Community', url: 'https://example.com/eggs' },
      service: 'createRepository',
      success: 201,
    },
    {
      name: 'import Egg',
      method: 'post',
      path: '/egg-repositories/repo-1/eggs/import',
      body: { key: 'sample', name: 'Sample', version: '1.0.0' },
      service: 'importEgg',
      success: 201,
    },
    {
      name: 'set repository status',
      method: 'patch',
      path: '/egg-repositories/repo-1/status',
      body: { status: 'ENABLED' },
      service: 'setRepositoryStatus',
      success: 200,
    },
    {
      name: 'set Egg status',
      method: 'patch',
      path: '/eggs/egg-1/status',
      body: { isEnabled: true },
      service: 'setEggStatus',
      success: 200,
    },
    {
      name: 'approve Egg',
      method: 'patch',
      path: '/eggs/egg-1/approval',
      body: { status: 'APPROVED' },
      service: 'setEggApproval',
      success: 200,
    },
  ] as const;

  describe.each(readRoutes)('GET $name', ({ path, service }) => {
    it('allows a non-Owner with egg:read', async () => {
      asUser(['Support'], ['egg:read']);

      await request(app.getHttpServer()).get(path).expect(200);

      expect(eggsService[service]).toHaveBeenCalledTimes(1);
    });

    it('denies service:manage:any without read permission', async () => {
      asUser(['Administrator'], ['service:manage:any']);

      await request(app.getHttpServer()).get(path).expect(403);

      expect(eggsService[service]).not.toHaveBeenCalled();
    });

    it('denies Owner without read permission', async () => {
      asUser(['Owner'], []);

      await request(app.getHttpServer()).get(path).expect(403);

      expect(eggsService[service]).not.toHaveBeenCalled();
    });
  });

  describe.each(writeRoutes)(
    '$method $name',
    ({ method, path, body, service, success }) => {
      const sendRequest = () => {
        const server = app.getHttpServer();

        if (method === 'post') {
          return request(server).post(path).send(body);
        }

        return request(server).patch(path).send(body);
      };

      it('allows a non-Owner with the operation permission', async () => {
        const required = service === 'importEgg' ? 'egg:import'
          : service === 'setEggApproval' ? 'egg:approve'
          : service === 'setEggStatus' ? 'egg:manage' : 'egg-repository:manage';
        asUser(['Administrator'], [required]);

        await sendRequest().expect(success);

        expect(eggsService[service]).toHaveBeenCalledTimes(1);
      });

      it('denies service:read:any without management permission', async () => {
        asUser(['Support'], ['egg:read']);

        await sendRequest().expect(403);

        expect(eggsService[service]).not.toHaveBeenCalled();
      });

      it('denies Owner without management permission', async () => {
        asUser(['Owner'], []);

        await sendRequest().expect(403);

        expect(eggsService[service]).not.toHaveBeenCalled();
      });
    },
  );
});

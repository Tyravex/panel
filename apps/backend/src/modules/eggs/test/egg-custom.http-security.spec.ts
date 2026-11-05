import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EggStatusController } from '../eggs.controller';
import { EggsService } from '../eggs.service';

describe('Egg custom and approval HTTP security', () => {
  let app: INestApplication;
  let authenticatedUser: Record<string, unknown> | null;

  const eggsService = {
    createCustomEgg: jest.fn(),
    listMyEggs: jest.fn(),
    setEggApproval: jest.fn(),
    setEggStatus: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EggStatusController],
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    authenticatedUser = {
      id: 42,
      roles: ['User'],
      permissions: [],
    };
  });

  afterAll(async () => {
    await app?.close();
  });

  it('denies anonymous custom submissions', async () => {
    authenticatedUser = null;
    await request(app.getHttpServer())
      .post('/eggs/custom')
      .send({ key: 'example' })
      .expect(403);
    expect(eggsService.createCustomEgg).not.toHaveBeenCalled();
  });

  it('denies anonymous access to owned Eggs', async () => {
    authenticatedUser = null;
    await request(app.getHttpServer()).get('/eggs/mine').expect(403);
    expect(eggsService.listMyEggs).not.toHaveBeenCalled();
  });

  it('uses the authenticated user ID instead of forged ownership metadata', async () => {
    const manifest = { key: 'example', ownerId: 999, sourceType: 'OFFICIAL', approvalStatus: 'APPROVED', isEnabled: true };
    eggsService.createCustomEgg.mockResolvedValue({ id: 'egg-1', ownerId: 42 });

    await request(app.getHttpServer())
      .post('/eggs/custom')
      .send(manifest)
      .expect(201);

    expect(eggsService.createCustomEgg).toHaveBeenCalledWith(42, manifest);
  });

  it('scopes the mine endpoint to the authenticated user', async () => {
    eggsService.listMyEggs.mockResolvedValue([{ id: 'owned-egg', ownerId: 42 }]);
    const response = await request(app.getHttpServer())
      .get('/eggs/mine')
      .query({ ownerId: 999 })
      .expect(200);

    expect(eggsService.listMyEggs).toHaveBeenCalledWith(42);
    expect(response.body).toEqual([{ id: 'owned-egg', ownerId: 42 }]);
  });

  it('does not allow ordinary users to approve Eggs', async () => {
    await request(app.getHttpServer())
      .patch('/eggs/egg-1/approval')
      .send({ status: 'APPROVED' })
      .expect(403);
    expect(eggsService.setEggApproval).not.toHaveBeenCalled();
  });

  it('requires both the Owner role and the administrative permission', async () => {
    authenticatedUser = { id: 42, roles: ['Owner'], permissions: [] };
    await request(app.getHttpServer())
      .patch('/eggs/egg-1/approval')
      .send({ status: 'APPROVED' })
      .expect(403);
    authenticatedUser = { id: 42, roles: ['User'], permissions: ['service:manage:any'] };
    await request(app.getHttpServer())
      .patch('/eggs/egg-1/approval')
      .send({ status: 'APPROVED' })
      .expect(403);
    expect(eggsService.setEggApproval).not.toHaveBeenCalled();
  });

  it('allows an administrator to submit a valid approval decision', async () => {
    authenticatedUser = { id: 7, roles: ['Owner'], permissions: ['service:manage:any'] };
    eggsService.setEggApproval.mockResolvedValue({ id: 'egg-1', approvalStatus: 'APPROVED' });
    await request(app.getHttpServer())
      .patch('/eggs/egg-1/approval')
      .send({ status: 'APPROVED' })
      .expect(200);
    expect(eggsService.setEggApproval).toHaveBeenCalledWith(7, 'egg-1', 'APPROVED');
  });

  it('rejects an invalid approval status before calling the service', async () => {
    authenticatedUser = { id: 7, roles: ['Owner'], permissions: ['service:manage:any'] };
    await request(app.getHttpServer())
      .patch('/eggs/egg-1/approval')
      .send({ status: 'PENDING' })
      .expect(400);
    expect(eggsService.setEggApproval).not.toHaveBeenCalled();
  });

  it('propagates manifest validation errors as HTTP 400', async () => {
    eggsService.createCustomEgg.mockRejectedValue(new BadRequestException('Invalid Egg manifest'));
    await request(app.getHttpServer())
      .post('/eggs/custom')
      .send({ invalid: true })
      .expect(400);
  });

  it('resolves the static mine route independently from dynamic Egg routes', async () => {
    eggsService.listMyEggs.mockResolvedValue([]);
    await request(app.getHttpServer()).get('/eggs/mine').expect(200);
    expect(eggsService.listMyEggs).toHaveBeenCalledTimes(1);
    expect(eggsService.setEggStatus).not.toHaveBeenCalled();
  });
});

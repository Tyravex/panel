import { INestApplication, type ExecutionContext, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { AdminServicesController } from '../admin-services.controller';
import { AdminServicesService } from '../admin-services.service';
import { ServicesService } from '../services.service';
import { ServiceEnvironmentService } from '../configuration/service-environment.service';
import { ServiceCompatibilityService } from '../configuration/service-compatibility.service';
import { AdminEggsController } from '@/modules/eggs/admin-eggs.controller';
import { EggsService } from '@/modules/eggs/eggs.service';
import { EggRepositorySyncService } from '@/modules/eggs/egg-repository-sync.service';

describe('Administrative Services and Eggs HTTP boundaries', () => {
  let app: INestApplication;
  let permissions: string[] = [];
  const admin = { list: jest.fn(), get: jest.fn(), save: jest.fn() };
  const services = { getAvailableEggs: jest.fn(), setOwner: jest.fn(), prepareInstall: jest.fn() };
  const eggs = { getManifest: jest.fn(), createVersion: jest.fn(), validateManifest: jest.fn(), renameRepository: jest.fn() };
  const sync = { preview: jest.fn(), sync: jest.fn() };
  const environment = { metadata: jest.fn(), update: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AdminServicesController, AdminEggsController], providers: [
      PermissionsGuard, { provide: AdminServicesService, useValue: admin }, { provide: ServicesService, useValue: services },
      { provide: EggsService, useValue: eggs }, { provide: EggRepositorySyncService, useValue: sync },
      { provide: ServiceEnvironmentService, useValue: environment },
      { provide: ServiceCompatibilityService, useValue: { get: jest.fn(), updates: jest.fn() } },
    ] }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: ExecutionContext) => {
      context.switchToHttp().getRequest().user = { id: 42, roles: ['Owner'], permissions }; return true;
    } }).compile();
    app = module.createNestApplication(); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })); await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { jest.resetAllMocks(); permissions = []; admin.list.mockResolvedValue([]); admin.save.mockResolvedValue({ id: 'service-1' }); sync.sync.mockResolvedValue({ imported: 1 }); });
  it('allows read-only service administrators without an Owner shortcut', async () => {
    await request(app.getHttpServer()).get('/admin/services').expect(403);
    permissions = ['service:read:any'];
    await request(app.getHttpServer()).get('/admin/services').expect(200);
    expect(admin.list).toHaveBeenCalledTimes(1);
  });
  it('does not grant Egg manifest access through service management', async () => {
    permissions = ['service:manage:any'];
    await request(app.getHttpServer()).get('/admin/eggs/egg-1/manifest').expect(403);
    expect(eggs.getManifest).not.toHaveBeenCalled();
    permissions = ['egg:read']; eggs.getManifest.mockResolvedValue({ id: 'egg-1' });
    await request(app.getHttpServer()).get('/admin/eggs/egg-1/manifest').expect(200);
  });
  it('requires transfer permission independently from configuration editing', async () => {
    permissions = ['service:manage:any'];
    await request(app.getHttpServer()).patch('/admin/services/service-1/owner').send({ userId: null }).expect(403);
    permissions = ['service:transfer:any'];
    await request(app.getHttpServer()).patch('/admin/services/service-1/owner').send({ userId: null }).expect(200);
    expect(services.setOwner).toHaveBeenCalledWith('service-1', 42, { userId: null });
  });
  it('rejects ownership changes smuggled into a configuration update', async () => {
    permissions = ['service:manage:any'];
    await request(app.getHttpServer()).patch('/admin/services/service-1').send({ name: 'Changed', userId: 99 }).expect(400);
    expect(admin.save).not.toHaveBeenCalled();
  });
  it('requires import as well as synchronization permission to write repository entries', async () => {
    permissions = ['egg-repository:sync'];
    await request(app.getHttpServer()).post('/admin/eggs/repositories/repo-1/sync').send({ paths: ['egg.json'] }).expect(403);
    permissions.push('egg:import');
    await request(app.getHttpServer()).post('/admin/eggs/repositories/repo-1/sync').send({ paths: ['egg.json'] }).expect(201);
    expect(sync.sync).toHaveBeenCalledWith(42, 'repo-1', ['egg.json'], undefined);
  });
  it('does not grant installation through general service management', async () => {
    permissions = ['service:manage:any'];
    await request(app.getHttpServer()).post('/admin/services/service-1/prepare-install').expect(403);
    permissions = ['service:install:any'];
    await request(app.getHttpServer()).post('/admin/services/service-1/prepare-install').expect(201);
    expect(services.prepareInstall).toHaveBeenCalledWith('service-1', 42, true);
  });
  it('requires service management to change environment values, even for Owner', async () => {
    permissions = ['service:read:any'];
    await request(app.getHttpServer()).patch('/admin/services/service-1/environment').send({ TOKEN: 'fixture-only' }).expect(403);
    expect(environment.update).not.toHaveBeenCalled();
    permissions = ['service:manage:any']; environment.update.mockResolvedValue({ configured: ['TOKEN'] });
    const response = await request(app.getHttpServer()).patch('/admin/services/service-1/environment').send({ TOKEN: 'fixture-only' }).expect(200);
    expect(environment.update).toHaveBeenCalledWith(42, 'service-1', { TOKEN: 'fixture-only' });
    expect(response.text).not.toContain('fixture-only');
  });
});

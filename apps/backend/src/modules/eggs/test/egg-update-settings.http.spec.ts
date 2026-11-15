import type { INestApplication, ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { EggUpdateSettingsController } from '../settings/egg-update-settings.controller';
import { EggUpdateSettingsService } from '../settings/egg-update-settings.service';
import { OfficialEggUpdateService } from '../settings/official-egg-update.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

describe('Egg update settings authorization', () => {
  let app: INestApplication; let permissions: string[] = [];
  const settings = { get: jest.fn(), update: jest.fn() }; const updates = { refresh: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [EggUpdateSettingsController], providers: [PermissionsGuard,
      { provide: EggUpdateSettingsService, useValue: settings }, { provide: OfficialEggUpdateService, useValue: updates }] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: ExecutionContext) => { context.switchToHttp().getRequest().user = { id: 42, roles: ['Owner'], permissions }; return true; } }).compile();
    app = module.createNestApplication(); await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => { jest.clearAllMocks(); permissions = []; settings.get.mockResolvedValue({ enabled: false }); settings.update.mockResolvedValue({ enabled: true }); });
  it('requires settings:read even for a role named Owner', async () => {
    await request(app.getHttpServer()).get('/admin/egg-settings').expect(403);
    permissions = ['settings:read']; await request(app.getHttpServer()).get('/admin/egg-settings').expect(200);
  });
  it('requires all three rights before enabling automatic imports', async () => {
    permissions = ['settings:manage'];
    await request(app.getHttpServer()).patch('/admin/egg-settings').send({ enabled: true }).expect(403);
    permissions.push('egg-repository:sync');
    await request(app.getHttpServer()).patch('/admin/egg-settings').send({ enabled: true }).expect(403);
    permissions.push('egg:import');
    await request(app.getHttpServer()).patch('/admin/egg-settings').send({ enabled: true }).expect(200);
    expect(settings.update).toHaveBeenCalledTimes(1);
  });
});

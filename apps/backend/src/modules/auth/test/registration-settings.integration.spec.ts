import 'dotenv/config';
import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RegistrationSettingsController } from '../registration-settings.controller';
import { RegistrationSettingsService } from '../registration-settings.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { requireIntegrationDatabase } from '@/test/test-database.guard';

describe('Registration settings - PostgreSQL integration', () => {
    let prisma: PrismaClient;
    let app: INestApplication;
    let settings: RegistrationSettingsService;
    let actorId: number;
    let originalSetting: { booleanValue: boolean } | null = null;
    let identity: { id: number; permissions: string[] } | null = null;
    const register = jest.fn();
    const key = 'registrationEnabled';

    beforeAll(async () => {
        // Validate the isolated database name before connecting or modifying data.
        const connectionString = requireIntegrationDatabase();
        prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
        await prisma.$connect();

        const actor = await prisma.user.findFirst({ select: { id: true }, orderBy: { id: 'asc' } });
        if (!actor) throw new Error('Integration database must contain a seeded user for audit attribution.');
        actorId = actor.id;
        originalSetting = await prisma.panelSetting.findUnique({ where: { key }, select: { booleanValue: true } });
        settings = new RegistrationSettingsService(prisma as PrismaService);

        const moduleRef = await Test.createTestingModule({
            controllers: [AuthController, RegistrationSettingsController],
            providers: [
                { provide: AuthService, useValue: { register } },
                { provide: RegistrationSettingsService, useValue: settings },
                PermissionsGuard,
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (context: any) => {
                    if (!identity) return false;
                    context.switchToHttp().getRequest().user = identity;
                    return true;
                },
            })
            .compile();
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    });

    afterAll(async () => {
        await app?.close();
        if (prisma) {
            // Restore the pre-test state even if an assertion fails.
            if (originalSetting) {
                await prisma.panelSetting.upsert({
                    where: { key },
                    create: { key, booleanValue: originalSetting.booleanValue },
                    update: { booleanValue: originalSetting.booleanValue },
                });
            } else {
                await prisma.panelSetting.deleteMany({ where: { key } });
            }
            await prisma.$disconnect();
        }
    });

    beforeEach(async () => {
        identity = null;
        jest.resetAllMocks();
        register.mockResolvedValue({ id: 123, username: 'integration-registration' });
        await prisma.panelSetting.deleteMany({ where: { key } });
    });

    it('defaults to disabled when no setting exists and blocks public registration', async () => {
        await request(app.getHttpServer()).get('/auth/registration-settings').expect(200, { enabled: false });
        await request(app.getHttpServer()).post('/auth/register')
            .send({ username: 'test', email: 'test@example.invalid', password: 'password' }).expect(403);
        expect(register).not.toHaveBeenCalled();
    });

    it('cannot be bypassed by a client-provided flag', async () => {
        await request(app.getHttpServer()).post('/auth/register')
            .send({ username: 'test', email: 'test@example.invalid', password: 'password', registrationEnabled: true })
            .expect(403);
        expect(register).not.toHaveBeenCalled();
    });

    it('requires authentication and user:manage for admin writes', async () => {
        await request(app.getHttpServer()).patch('/admin/registration-settings')
            .send({ registrationEnabled: true }).expect(403);
        identity = { id: actorId, permissions: ['user:read'] };
        await request(app.getHttpServer()).patch('/admin/registration-settings')
            .send({ registrationEnabled: true }).expect(403);
        expect(await settings.isRegistrationEnabled()).toBe(false);
    });

    it('rejects invalid values without persisting changes', async () => {
        identity = { id: actorId, permissions: ['user:manage'] };
        for (const payload of [{ registrationEnabled: 'true' }, { registrationEnabled: true, role: 'Owner' }, {}]) {
            await request(app.getHttpServer()).patch('/admin/registration-settings').send(payload).expect(400);
        }
        expect(await settings.isRegistrationEnabled()).toBe(false);
    });

    it('persists an authorized toggle and reads it through both HTTP endpoints', async () => {
        identity = { id: actorId, permissions: ['user:manage'] };
        await request(app.getHttpServer()).patch('/admin/registration-settings')
            .send({ registrationEnabled: true }).expect(200, { registrationEnabled: true });
        await request(app.getHttpServer()).get('/admin/registration-settings')
            .expect(200, { registrationEnabled: true });
        await request(app.getHttpServer()).get('/auth/registration-settings')
            .expect(200, { enabled: true });
        await request(app.getHttpServer()).post('/auth/register')
            .send({ username: 'test', email: 'test@example.invalid', password: 'password' }).expect(201);
        expect(register).toHaveBeenCalledTimes(1);
        expect(await prisma.panelSetting.findUnique({ where: { key } })).toMatchObject({ booleanValue: true });

        // A fresh service instance observes the same stored value.
        const anotherInstance = new RegistrationSettingsService(prisma as PrismaService);
        expect(await anotherInstance.isRegistrationEnabled()).toBe(true);

        await request(app.getHttpServer()).patch('/admin/registration-settings')
            .send({ registrationEnabled: false }).expect(200, { registrationEnabled: false });
        await request(app.getHttpServer()).post('/auth/register').send({}).expect(403);
        expect(register).toHaveBeenCalledTimes(1);
    });

    it('records actual changes and avoids duplicate audit entries for unchanged values', async () => {
        identity = { id: actorId, permissions: ['user:manage'] };
        const where = { actorId, action: 'REGISTRATION_SETTING_CHANGED', targetType: 'PANEL_SETTING', targetId: key };
        const before = await prisma.adminAuditLog.count({ where });
        await request(app.getHttpServer()).patch('/admin/registration-settings')
            .send({ registrationEnabled: true }).expect(200);
        await request(app.getHttpServer()).patch('/admin/registration-settings')
            .send({ registrationEnabled: true }).expect(200);
        expect(await prisma.adminAuditLog.count({ where })).toBe(before + 1);
        const latest = await prisma.adminAuditLog.findFirst({ where, orderBy: { id: 'desc' } });
        expect(latest?.metadata).toMatchObject({ previous: false, enabled: true });
    });

    it('does not commit a setting change if the audit actor is invalid', async () => {
        // A nonexistent actor should violate the audit FK and roll back the setting update.
        const nonexistentActor = (await prisma.user.aggregate({ _max: { id: true } }))._max.id! + 1000000;
        await expect(settings.setRegistrationEnabled(true, nonexistentActor)).rejects.toThrow();
        expect(await settings.isRegistrationEnabled()).toBe(false);
    });

    it('rejects invalid service values without modifying the database', async () => {
        await expect(settings.setRegistrationEnabled('true', actorId)).rejects.toThrow(BadRequestException);
        expect(await settings.isRegistrationEnabled()).toBe(false);
    });
});

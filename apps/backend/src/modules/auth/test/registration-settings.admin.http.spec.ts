import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RegistrationSettingsController } from '../registration-settings.controller';
import { RegistrationSettingsService } from '../registration-settings.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

describe('Registration settings - admin HTTP security', () => {
    let app: INestApplication;
    const isRegistrationEnabled = jest.fn();
    const setRegistrationEnabled = jest.fn();
    let identity: { id: number; permissions: string[] } | null;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [RegistrationSettingsController],
            providers: [{
                provide: RegistrationSettingsService,
                useValue: { isRegistrationEnabled, setRegistrationEnabled },
            }, PermissionsGuard],
        })
            // Override the guard metadata used by Nest, not only its provider token.
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
    afterAll(async () => { await app?.close(); });
    beforeEach(() => {
        jest.resetAllMocks();
        identity = null;
        isRegistrationEnabled.mockResolvedValue(false);
        setRegistrationEnabled.mockResolvedValue({ registrationEnabled: true });
    });

    it('rejects anonymous reads and writes', async () => {
        await request(app.getHttpServer()).get('/admin/registration-settings').expect(403);
        await request(app.getHttpServer()).patch('/admin/registration-settings')
            .send({ registrationEnabled: true }).expect(403);
        expect(setRegistrationEnabled).not.toHaveBeenCalled();
    });

    it('rejects users without user:manage', async () => {
        identity = { id: 9, permissions: ['user:read'] };
        await request(app.getHttpServer()).get('/admin/registration-settings').expect(403);
        await request(app.getHttpServer()).patch('/admin/registration-settings')
            .send({ registrationEnabled: true }).expect(403);
        expect(setRegistrationEnabled).not.toHaveBeenCalled();
    });

    it('allows user:manage to read and change the setting', async () => {
        identity = { id: 7, permissions: ['user:manage'] };
        await request(app.getHttpServer()).get('/admin/registration-settings')
            .expect(200, { registrationEnabled: false });
        await request(app.getHttpServer()).patch('/admin/registration-settings')
            .send({ registrationEnabled: true }).expect(200, { registrationEnabled: true });
        expect(setRegistrationEnabled).toHaveBeenCalledWith(true, 7);
    });

    it.each([
        {}, { registrationEnabled: 'true' }, { registrationEnabled: 1 },
        { registrationEnabled: null }, { registrationEnabled: true, role: 'Owner' },
        { enabled: true }, [],
    ])('rejects invalid update payload %p', async (body) => {
        identity = { id: 7, permissions: ['user:manage'] };
        await request(app.getHttpServer()).patch('/admin/registration-settings').send(body).expect(400);
        expect(setRegistrationEnabled).not.toHaveBeenCalled();
    });
});

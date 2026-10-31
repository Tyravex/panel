import {
    CanActivate,
    ExecutionContext,
    INestApplication,
    MiddlewareConsumer,
    Module,
    NestModule,
    RequestMethod,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { raw } from 'express';
import request from 'supertest';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

import { PluginInstallerService } from '../plugin-installer.service';
import { PluginsController } from '../plugins.controller';
import { MAX_PLUGIN_UPLOAD_BYTES } from '../plugins.module';
import { PluginsService } from '../plugins.service';

const installer = {
    installLanguagePackage: jest.fn(),
};

const pluginsService = {
    listForAdmin: jest.fn(),
    getForAdmin: jest.fn(),
};

class TestAuthenticationGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const httpRequest = context.switchToHttp().getRequest<{
            headers: Record<string, string | undefined>;
            user?: { permissions: string[] };
        }>();

        const auth = httpRequest.headers.authorization;

        if (auth !== 'Bearer test-admin' &&
            auth !== 'Bearer test-user') {
            return false;
        }

        httpRequest.user = {
            permissions:
                auth === 'Bearer test-admin'
                    ? ['plugin:manage']
                    : [],
        };

        return true;
    }
}

@Module({
    controllers: [PluginsController],
    providers: [
        PermissionsGuard,
        {
            provide: PluginsService,
            useValue: pluginsService,
        },
        {
            provide: PluginInstallerService,
            useValue: installer,
        },
    ],
})
class PluginHttpTestModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(
                raw({
                    type: 'application/zip',
                    limit: MAX_PLUGIN_UPLOAD_BYTES,
                    inflate: false,
                }),
            )
            .forRoutes({
                path: 'admin/plugins/install',
                method: RequestMethod.POST,
            });
    }
}

describe('Plugin installation HTTP', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [PluginHttpTestModule],
        })
            .overrideGuard(JwtAuthGuard)
            .useClass(TestAuthenticationGuard)
            .compile();

        app = moduleRef.createNestApplication({
            logger: false,
        });
        await app.init();
    });

    afterAll(async () => {
        await app?.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();

        installer.installLanguagePackage.mockResolvedValue({
            id: 'example.language',
            type: 'LANGUAGE',
            version: '1.0.0',
            status: 'INSTALLED',
        });
    });

    it('returns 403 without authentication', async () => {
        const response = await request(app.getHttpServer())
            .post('/admin/plugins/install')
            .set('Content-Type', 'application/zip')
            .send(Buffer.from('fixture'));

        expect(response.status).toBe(403);
        expect(installer.installLanguagePackage).not.toHaveBeenCalled();
    });

    it('returns 403 without plugin:manage permission', async () => {
        const response = await request(app.getHttpServer())
            .post('/admin/plugins/install')
            .set('Authorization', 'Bearer test-user')
            .set('Content-Type', 'application/zip')
            .send(Buffer.from('fixture'));

        expect(response.status).toBe(403);
        expect(installer.installLanguagePackage).not.toHaveBeenCalled();
    });

    it('accepts an authorized ZIP upload', async () => {
        const archive = Buffer.from('fixture');

        const response = await request(app.getHttpServer())
            .post('/admin/plugins/install')
            .set('Authorization', 'Bearer test-admin')
            .set('Content-Type', 'application/zip')
            .send(archive);

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
            id: 'example.language',
            type: 'LANGUAGE',
            version: '1.0.0',
            status: 'INSTALLED',
        });

        expect(installer.installLanguagePackage).toHaveBeenCalledTimes(1);
        expect(installer.installLanguagePackage).toHaveBeenCalledWith(
            archive,
        );
    });

    it('rejects an empty ZIP body', async () => {
        const response = await request(app.getHttpServer())
            .post('/admin/plugins/install')
            .set('Authorization', 'Bearer test-admin')
            .set('Content-Type', 'application/zip')
            .send(Buffer.alloc(0));

        expect(response.status).toBe(400);
        expect(installer.installLanguagePackage).not.toHaveBeenCalled();
    });

    it('rejects an unsupported content type', async () => {
        const response = await request(app.getHttpServer())
            .post('/admin/plugins/install')
            .set('Authorization', 'Bearer test-admin')
            .set('Content-Type', 'application/json')
            .send({ archive: 'invalid' });

        expect(response.status).toBe(415);
        expect(installer.installLanguagePackage).not.toHaveBeenCalled();
    });

    it('rejects a request larger than 20 MiB', async () => {
        const oversizedArchive = Buffer.alloc(
            MAX_PLUGIN_UPLOAD_BYTES + 1,
            0x41,
        );

        const response = await request(app.getHttpServer())
            .post('/admin/plugins/install')
            .set('Authorization', 'Bearer test-admin')
            .set('Content-Type', 'application/zip')
            .send(oversizedArchive);

        expect(response.status).toBe(413);
        expect(installer.installLanguagePackage).not.toHaveBeenCalled();
    });

    it('preserves the installer conflict response', async () => {
        const { ConflictException } = await import('@nestjs/common');

        installer.installLanguagePackage.mockRejectedValue(
            new ConflictException('Plugin is already registered.'),
        );

        const response = await request(app.getHttpServer())
            .post('/admin/plugins/install')
            .set('Authorization', 'Bearer test-admin')
            .set('Content-Type', 'application/zip')
            .send(Buffer.from('fixture'));

        expect(response.status).toBe(409);
    });

    it('does not expose internal installer error details', async () => {
        installer.installLanguagePackage.mockRejectedValue(
            new Error('Private database connection details'),
        );

        const response = await request(app.getHttpServer())
            .post('/admin/plugins/install')
            .set('Authorization', 'Bearer test-admin')
            .set('Content-Type', 'application/zip')
            .send(Buffer.from('fixture'));

        expect(response.status).toBe(500);
        expect(JSON.stringify(response.body)).not.toContain(
            'Private database connection details',
        );
    });
});

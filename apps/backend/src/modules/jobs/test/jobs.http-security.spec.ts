import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JobType } from '@prisma/client';
import { sign } from 'jsonwebtoken';
import request from 'supertest';

import { PrismaService } from '@/prisma/prisma.service';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { JobsController } from '../jobs.controller';
import { JobsService } from '../jobs.service';

describe('Jobs HTTP security boundaries', () => {
    let app: INestApplication;
    const originalSecret = process.env.JWT_SECRET;
    const secret = 'tyravex-jobs-http-security-test-only';
    const userFindUnique = jest.fn();
    const sessionFindUnique = jest.fn();
    const serverFindFirst = jest.fn();
    const jobCreate = jest.fn();
    const jobFindMany = jest.fn();
    const jobFindFirst = jest.fn();

    const tokenFor = (userId: number, permissions: string[] = []) => {
        userFindUnique.mockResolvedValue({
            id: userId,
            username: `user-${userId}`,
            email: `user-${userId}@example.invalid`,
            avatar: null,
            language: 'en',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            roles: [{
                role: {
                    name: 'test-role',
                    permissions: permissions.map((name) => ({ name })),
                },
            }],
        });
        sessionFindUnique.mockResolvedValue({
            id: 'jobs-http-test-session',
            userId,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
        });
        return sign(
            { sub: userId, sid: 'jobs-http-test-session', tokenType: 'access' },
            secret,
            { expiresIn: '1h' },
        );
    };

    beforeAll(async () => {
        process.env.JWT_SECRET = secret;
        const moduleRef = await Test.createTestingModule({
            controllers: [JobsController],
            providers: [
                JobsService,
                JwtStrategy,
                {
                    provide: PrismaService,
                    useValue: {
                        user: { findUnique: userFindUnique },
                        session: { findUnique: sessionFindUnique },
                        server: { findFirst: serverFindFirst },
                        job: {
                            create: jobCreate,
                            findMany: jobFindMany,
                            findFirst: jobFindFirst,
                        },
                    },
                },
            ],
        }).compile();
        app = moduleRef.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app?.close();
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });

    beforeEach(() => {
        jest.resetAllMocks();
        serverFindFirst.mockResolvedValue({ id: 20 });
        jobCreate.mockResolvedValue({ id: 'job-created' });
        jobFindMany.mockResolvedValue([]);
        jobFindFirst.mockResolvedValue(null);
    });

    it('rejects unauthenticated list, read and create requests', async () => {
        await request(app.getHttpServer()).get('/jobs').expect(401);
        await request(app.getHttpServer()).get('/jobs/job-1').expect(401);
        await request(app.getHttpServer())
            .post('/jobs').send({ type: JobType.RESTART, serverId: 20 }).expect(401);
        expect(serverFindFirst).not.toHaveBeenCalled();
        expect(jobFindMany).not.toHaveBeenCalled();
        expect(jobFindFirst).not.toHaveBeenCalled();
        expect(jobCreate).not.toHaveBeenCalled();
    });

    it('lists only jobs owned by the JWT user', async () => {
        const token = tokenFor(7);
        await request(app.getHttpServer()).get('/jobs')
            .set('Authorization', `Bearer ${token}`).expect(200);
        expect(jobFindMany).toHaveBeenCalledWith({
            where: { userId: 7 },
            orderBy: { createdAt: 'desc' },
        });
    });

    it('scopes individual job lookups to the JWT user', async () => {
        const token = tokenFor(7);
        jobFindFirst.mockResolvedValue({ id: 'job-1', userId: 7 });
        await request(app.getHttpServer()).get('/jobs/job-1')
            .set('Authorization', `Bearer ${token}`).expect(200);
        expect(jobFindFirst).toHaveBeenCalledWith({
            where: { id: 'job-1', userId: 7 },
        });
    });

    it('returns 404 for a missing or foreign job', async () => {
        const token = tokenFor(7);
        await request(app.getHttpServer()).get('/jobs/foreign-job')
            .set('Authorization', `Bearer ${token}`).expect(404);
        expect(jobFindFirst).toHaveBeenCalledWith({
            where: { id: 'foreign-job', userId: 7 },
        });
    });

    it('creates a job for an owned server and assigns JWT ownership', async () => {
        const token = tokenFor(7);
        await request(app.getHttpServer()).post('/jobs')
            .set('Authorization', `Bearer ${token}`)
            .send({ type: JobType.RESTART, serverId: 20, userId: 999 })
            .expect(201);
        expect(serverFindFirst).toHaveBeenCalledWith({
            where: { id: 20, userId: 7 },
            select: { id: true },
        });
        expect(jobCreate).toHaveBeenCalledWith({
            data: {
                type: JobType.RESTART,
                userId: 7,
                serverId: 20,
                status: 'PENDING',
                progress: 0,
            },
        });
    });

    it('rejects job creation for an inaccessible server', async () => {
        const token = tokenFor(7);
        serverFindFirst.mockResolvedValue(null);
        await request(app.getHttpServer()).post('/jobs')
            .set('Authorization', `Bearer ${token}`)
            .send({ type: JobType.RESTART, serverId: 20 })
            .expect(404);
        expect(serverFindFirst).toHaveBeenCalledWith({
            where: { id: 20, userId: 7 },
            select: { id: true },
        });
        expect(jobCreate).not.toHaveBeenCalled();
    });

    it('allows server:manage:any to target another server but retains job ownership', async () => {
        const token = tokenFor(7, ['server:manage:any']);
        await request(app.getHttpServer()).post('/jobs')
            .set('Authorization', `Bearer ${token}`)
            .send({ type: JobType.BACKUP, serverId: 20 })
            .expect(201);
        expect(serverFindFirst).toHaveBeenCalledWith({
            where: { id: 20 },
            select: { id: true },
        });
        expect(jobCreate).toHaveBeenCalledWith({
            data: {
                type: JobType.BACKUP,
                userId: 7,
                serverId: 20,
                status: 'PENDING',
                progress: 0,
            },
        });
    });

    it('does not infer global server access from an admin role name', async () => {
        const token = tokenFor(7);
        serverFindFirst.mockResolvedValue(null);
        await request(app.getHttpServer()).post('/jobs')
            .set('Authorization', `Bearer ${token}`)
            .send({ type: JobType.INSTALL, serverId: 20 })
            .expect(404);
        expect(serverFindFirst).toHaveBeenCalledWith({
            where: { id: 20, userId: 7 },
            select: { id: true },
        });
    });

    it('rejects a JWT tied to a revoked session', async () => {
        const token = tokenFor(7);
        sessionFindUnique.mockResolvedValue({
            id: 'jobs-http-test-session',
            userId: 7,
            revokedAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
        });
        await request(app.getHttpServer()).get('/jobs')
            .set('Authorization', `Bearer ${token}`).expect(401);
        expect(jobFindMany).not.toHaveBeenCalled();
    });

    it('rejects a JWT tied to another user session', async () => {
        const token = tokenFor(7);
        sessionFindUnique.mockResolvedValue({
            id: 'jobs-http-test-session',
            userId: 8,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
        });
        await request(app.getHttpServer()).get('/jobs')
            .set('Authorization', `Bearer ${token}`).expect(401);
        expect(jobFindMany).not.toHaveBeenCalled();
    });
});

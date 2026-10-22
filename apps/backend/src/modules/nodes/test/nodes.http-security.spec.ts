import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { AgentWebSocketLifecycle } from '../transport/agent-websocket.lifecycle';
import { NodesController } from '../nodes.controller';
import { NodesService } from '../nodes.service';

describe('Nodes HTTP security', () => {
    const findById = jest.fn();
    const createNode = jest.fn();
    const rotateToken = jest.fn();
    const disconnectNode = jest.fn();
    let app: INestApplication;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [NodesController],
            providers: [
                Reflector,
                PermissionsGuard,
                { provide: NodesService, useValue: { findById, createNode, rotateToken } },
                { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
                { provide: AgentWebSocketLifecycle, useValue: { disconnectNode } },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (context: any) => {
                    const req = context.switchToHttp().getRequest();
                    if (req.headers['x-test-auth'] !== 'valid') return false;
                    req.user = {
                        id: 7,
                        permissions: req.headers['x-test-permission'] === 'manage' ? ['node:manage'] : [],
                    };
                    return true;
                },
            })
            .compile();

        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
        await app.init();
    });

    beforeEach(() => {
        jest.resetAllMocks();
        findById.mockResolvedValue({ id: 'node-1', name: 'Node', status: 'OFFLINE' });
        createNode.mockResolvedValue({ id: 'node-1', name: 'Node', token: 'new-token' });
        rotateToken.mockResolvedValue({ id: 'node-1', name: 'Node', token: 'rotated-token' });
    });

    afterAll(async () => {
        await app?.close();
    });

    const authorized = (req: request.Test) => req
        .set('x-test-auth', 'valid')
        .set('x-test-permission', 'manage');

    it('blocks unauthenticated node reads', async () => {
        await request(app.getHttpServer()).get('/nodes/node-1').expect(403);
        expect(findById).not.toHaveBeenCalled();
    });

    it('blocks node reads without node:manage', async () => {
        await request(app.getHttpServer()).get('/nodes/node-1')
            .set('x-test-auth', 'valid').expect(403);
        expect(findById).not.toHaveBeenCalled();
    });

    it('allows permitted node metadata reads', async () => {
        const response = await authorized(request(app.getHttpServer()).get('/nodes/node-1')).expect(200);
        expect(response.body).toEqual({ id: 'node-1', name: 'Node', status: 'OFFLINE' });
        expect(findById).toHaveBeenCalledWith('node-1');
    });

    it('blocks node creation without permission', async () => {
        await request(app.getHttpServer()).post('/nodes')
            .set('x-test-auth', 'valid').send({ name: 'Node' }).expect(403);
        expect(createNode).not.toHaveBeenCalled();
    });

    it('rejects invalid node creation bodies', async () => {
        await authorized(request(app.getHttpServer()).post('/nodes'))
            .send({ name: '' }).expect(400);
        await authorized(request(app.getHttpServer()).post('/nodes'))
            .send({ name: 'x'.repeat(101) }).expect(400);
        await authorized(request(app.getHttpServer()).post('/nodes'))
            .send({ name: 123 }).expect(400);
        expect(createNode).not.toHaveBeenCalled();
    });

    it('returns newly provisioned credentials with no-store', async () => {
        const response = await authorized(request(app.getHttpServer()).post('/nodes'))
            .send({ name: 'Node' }).expect(201);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.body.token).toBe('new-token');
        expect(createNode).toHaveBeenCalledWith('Node');
    });

    it('blocks token rotation without permission', async () => {
        await request(app.getHttpServer()).post('/nodes/node-1/rotate-token')
            .set('x-test-auth', 'valid').expect(403);
        expect(rotateToken).not.toHaveBeenCalled();
    });

    it('returns rotated credentials with no-store', async () => {
        const response = await authorized(request(app.getHttpServer()).post('/nodes/node-1/rotate-token'))
            .expect(201);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.body.token).toBe('rotated-token');
        expect(rotateToken).toHaveBeenCalledWith('node-1');
        expect(disconnectNode).toHaveBeenCalledWith('node-1');
    });

    it('does not disconnect node when token rotation fails', async () => {
        rotateToken.mockRejectedValue(
            new Error('Database unavailable'),
        );

        await authorized(
            request(app.getHttpServer()).post(
                '/nodes/node-1/rotate-token',
            ),
        ).expect(500);

        expect(disconnectNode).not.toHaveBeenCalled();
    });
});

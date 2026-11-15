import { expectTestLogs } from '@/test/helpers/expected-test-log';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { AgentWebSocketLifecycle } from '../transport/websocket/agent-websocket.lifecycle';
import { NodesController } from '../nodes.controller';
import { NodesService } from '../nodes.service';

describe('Nodes HTTP security', () => {
    const findById = jest.fn();
    const createNode = jest.fn();
    const rotateToken = jest.fn();
    const deleteNode = jest.fn();
    const findAll = jest.fn();
    const updateNode = jest.fn();
    const disconnectNode = jest.fn();
    let app: INestApplication;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [NodesController],
            providers: [
                Reflector,
                PermissionsGuard,
                { provide: NodesService, useValue: { findById, createNode, rotateToken, deleteNode, findAll, updateNode } },
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
                        permissions: (() => {
                            const permission = req.headers['x-test-permission'];
                            if (permission === 'read') return ['node:read'];
                            if (permission === 'manage') return ['node:manage'];
                            if (permission === 'delete') return ['node:delete'];
                            return [];
                        })(),
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
        deleteNode.mockResolvedValue({ success: true });
        findAll.mockResolvedValue([]);
        updateNode.mockResolvedValue({ id: 'node-1', name: 'Updated Node' });
    });

    afterAll(async () => {
        await app?.close();
    });

    const authorized = (req: request.Test) => req
        .set('x-test-auth', 'valid')
        .set('x-test-permission', 'manage');

    const withPermission = (req: request.Test, permission: string) => req
        .set('x-test-auth', 'valid')
        .set('x-test-permission', permission);

    it('blocks unauthenticated node reads', async () => {
        await request(app.getHttpServer()).get('/nodes/node-1').expect(403);
        expect(findById).not.toHaveBeenCalled();
    });

    it('blocks node reads without node:read', async () => {
        await request(app.getHttpServer()).get('/nodes/node-1')
            .set('x-test-auth', 'valid').expect(403);
        expect(findById).not.toHaveBeenCalled();
    });

    it('allows permitted node metadata reads', async () => {
        const response = await withPermission(
            request(app.getHttpServer()).get('/nodes/node-1'),
            'read',
        ).expect(200);
        expect(response.body).toEqual({ id: 'node-1', name: 'Node', status: 'OFFLINE' });
        expect(findById).toHaveBeenCalledWith('node-1');
    });

    it('allows node list reads with node:read', async () => {
        await withPermission(
            request(app.getHttpServer()).get('/nodes'),
            'read',
        ).expect(200);

        expect(findAll).toHaveBeenCalledTimes(1);
    });

    it('blocks node list reads with only node:manage', async () => {
        await withPermission(
            request(app.getHttpServer()).get('/nodes'),
            'manage',
        ).expect(403);

        expect(findAll).not.toHaveBeenCalled();
    });

    it('blocks node creation with only node:read', async () => {
        await withPermission(
            request(app.getHttpServer()).post('/nodes'),
            'read',
        ).send({ name: 'Node' }).expect(403);

        expect(createNode).not.toHaveBeenCalled();
    });

    it('blocks node updates with only node:read', async () => {
        await withPermission(
            request(app.getHttpServer()).patch('/nodes/node-1'),
            'read',
        ).send({ name: 'Updated Node' }).expect(403);

        expect(updateNode).not.toHaveBeenCalled();
    });

    it('allows node updates with node:manage', async () => {
        await withPermission(
            request(app.getHttpServer()).patch('/nodes/node-1'),
            'manage',
        ).send({ name: 'Updated Node' }).expect(200);

        expect(updateNode).toHaveBeenCalledWith(
            'node-1',
            { name: 'Updated Node' },
            7,
        );
    });

    it('blocks token rotation with only node:read', async () => {
        await withPermission(
            request(app.getHttpServer()).post('/nodes/node-1/rotate-token'),
            'read',
        ).expect(403);

        expect(rotateToken).not.toHaveBeenCalled();
        expect(disconnectNode).not.toHaveBeenCalled();
    });

    it('blocks node deletion without permissions', async () => {
        await request(app.getHttpServer())
            .delete('/nodes/node-1')
            .set('x-test-auth', 'valid')
            .expect(403);

        expect(deleteNode).not.toHaveBeenCalled();
        expect(disconnectNode).not.toHaveBeenCalled();
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
        expect(createNode).toHaveBeenCalledWith({ name: 'Node' });
    });

    it('blocks node reads with only node:manage', async () => {
        await withPermission(
            request(app.getHttpServer()).get('/nodes/node-1'),
            'manage',
        ).expect(403);

        expect(findById).not.toHaveBeenCalled();
    });

    it('blocks node deletion with only node:manage', async () => {
        await withPermission(
            request(app.getHttpServer()).delete('/nodes/node-1'),
            'manage',
        ).expect(403);

        expect(deleteNode).not.toHaveBeenCalled();
        expect(disconnectNode).not.toHaveBeenCalled();
    });

    it('blocks node deletion with only node:read', async () => {
        await withPermission(
            request(app.getHttpServer()).delete('/nodes/node-1'),
            'read',
        ).expect(403);

        expect(deleteNode).not.toHaveBeenCalled();
        expect(disconnectNode).not.toHaveBeenCalled();
    });

    it('allows node deletion with node:delete', async () => {
        await withPermission(
            request(app.getHttpServer()).delete('/nodes/node-1'),
            'delete',
        ).expect(200);

        expect(deleteNode).toHaveBeenCalledWith('node-1', 7);
        expect(disconnectNode).toHaveBeenCalledWith('node-1');
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
    // Expected fault-injection logs are checked locally; other logs remain visible.
    let expectedLogs: ReturnType<typeof expectTestLogs>;
    beforeEach(() => {
        expectedLogs = expectTestLogs({
            'error': ["Database unavailable"],
        });
    });
    afterEach(() => expectedLogs.restore());

});

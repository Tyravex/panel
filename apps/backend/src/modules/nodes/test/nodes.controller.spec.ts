import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { PERMISSIONS_KEY } from '@/rbac/decorators/permissions.decorator';
import { AgentWebSocketLifecycle } from '../transport/websocket/agent-websocket.lifecycle';
import { NodesController } from '../nodes.controller';

describe('NodesController authorization', () => {
    it('requires JWT authentication before permission verification', () => {
        const guards = Reflect.getMetadata(
            GUARDS_METADATA,
            NodesController,
        );

        expect(guards).toEqual([
            JwtAuthGuard,
            PermissionsGuard,
        ]);
    });

    it('requires node:manage permission', () => {
        const permissions = Reflect.getMetadata(
            PERMISSIONS_KEY,
            NodesController,
        );

        expect(permissions).toEqual(['node:manage']);
    });

    it.each([
        ['findAll', 'node:read'],
        ['findOne', 'node:read'],
        ['remove', 'node:delete'],
    ])('requires %s permission %s', (method, permission) => {
        const permissions = Reflect.getMetadata(
            PERMISSIONS_KEY,
            NodesController.prototype[method as 'findAll' | 'findOne' | 'remove'],
        );

        expect(permissions).toEqual([permission]);
    });

    it.each(['create', 'update', 'rotateToken'])(
        'keeps node:manage as the class-level requirement for %s',
        (method) => {
            const permissions = Reflect.getMetadata(
                PERMISSIONS_KEY,
                NodesController.prototype[method as 'create' | 'update' | 'rotateToken'],
            );

            expect(permissions).toBeUndefined();
        },
    );
    it('does not expose token hashes through the controller', async () => {
        const controller = new NodesController(
            {
                findById: jest.fn().mockResolvedValue({
                    // Tutaj pozostaw dokładnie swoje dotychczasowe dane.
                }),
            } as any,
            {
                disconnectNode: jest.fn(),
            } as unknown as AgentWebSocketLifecycle,
        );

        await expect(
            controller.findOne('node-test'),
        ).resolves.not.toHaveProperty('tokenHash');
    });
});

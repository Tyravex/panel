import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { UserDTO } from '@shared/types';
import { ServerController } from '../server.controller';
import { ServerService } from '../server.service';

describe('ServerController security', () => {
    const getUserServers = jest.fn();
    const getUserServer = jest.fn();
    const createServer = jest.fn();
    let controller: ServerController;

    const user = (id: number, permissions: string[] = []): UserDTO => ({
        id,
        username: `user-${id}`,
        email: `user-${id}@example.test`,
        roles: ['user'],
        permissions,
        createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const request = (id: number, permissions: string[] = []) => ({
        user: user(id, permissions),
    });

    beforeEach(() => {
        jest.resetAllMocks();
        controller = new ServerController({
            getUserServers,
            getUserServer,
            createServer,
        } as unknown as ServerService);
    });

    it('protects all server routes with JwtAuthGuard', () => {
        const guards = Reflect.getMetadata(GUARDS_METADATA, ServerController);
        expect(guards).toContain(JwtAuthGuard);
    });

    it('uses the authenticated user ID when listing servers', async () => {
        const servers = [{ id: 2, userId: 11 }];
        getUserServers.mockResolvedValue(servers);
        await expect(controller.getUserServers(request(11))).resolves.toBe(servers);
        expect(getUserServers).toHaveBeenCalledWith(11);
    });

    it('passes the authenticated user ID when fetching a single server', async () => {
        const server = { id: 2, userId: 11 };
        getUserServer.mockResolvedValue(server);
        await expect(controller.getUserServer(request(11), 2)).resolves.toBe(server);
        expect(getUserServer).toHaveBeenCalledWith(2, 11);
    });

    it('does not grant cross-user read access based on server:manage:any', async () => {
        getUserServer.mockResolvedValue(null);
        await controller.getUserServer(request(11, ['server:manage:any']), 2);
        expect(getUserServer).toHaveBeenCalledWith(2, 11);
    });

    it('rejects server creation without server:create', () => {
        expect(() =>
            controller.createServer(request(11), { userId: 11, name: 'Test' }),
        ).toThrow(ForbiddenException);
        expect(createServer).not.toHaveBeenCalled();
    });

    it('does not treat server:manage:any as server:create', () => {
        expect(() =>
            controller.createServer(
                request(11, ['server:manage:any']),
                { userId: 11, name: 'Test' },
            ),
        ).toThrow(ForbiddenException);
        expect(createServer).not.toHaveBeenCalled();
    });

    it('allows explicit server:create and preserves the selected owner', async () => {
        const server = { id: 3, userId: 42 };
        createServer.mockResolvedValue(server);
        await expect(
            controller.createServer(
                request(11, ['server:create']),
                { userId: 42, name: 'Production' },
            ),
        ).resolves.toBe(server);
        expect(createServer).toHaveBeenCalledWith(42, 'Production');
    });

    it('does not use the request body to determine the authenticated user for reads', async () => {
        getUserServers.mockResolvedValue([]);
        await controller.getUserServers(request(11));
        expect(getUserServers).toHaveBeenCalledWith(11);
        expect(createServer).not.toHaveBeenCalled();
    });
});

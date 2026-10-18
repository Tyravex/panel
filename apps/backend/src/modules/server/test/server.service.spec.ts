import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { ServerService } from '../server.service';

describe('ServerService security', () => {
    const findMany = jest.fn();
    const findFirst = jest.fn();
    const create = jest.fn();
    const createNotification = jest.fn();
    const sendToUser = jest.fn();
    let service: ServerService;

    beforeEach(() => {
        jest.resetAllMocks();
        service = new ServerService(
            { server: { findMany, findFirst, create } } as unknown as PrismaService,
            { create: createNotification } as unknown as NotificationsService,
            { sendToUser } as unknown as NotificationsGateway,
        );
    });

    it('lists only servers belonging to the authenticated user', async () => {
        const servers = [{ id: 4, userId: 11 }];
        findMany.mockResolvedValue(servers);
        await expect(service.getUserServers(11)).resolves.toBe(servers);
        expect(findMany).toHaveBeenCalledWith({
            where: { userId: 11 },
            orderBy: { createdAt: 'desc' },
        });
    });

    it('uses both server ID and owner ID when fetching a server', async () => {
        const server = { id: 4, userId: 11 };
        findFirst.mockResolvedValue(server);
        await expect(service.getUserServer(4, 11)).resolves.toBe(server);
        expect(findFirst).toHaveBeenCalledWith({ where: { id: 4, userId: 11 } });
    });

    it('returns NotFound when a server is not owned by the user', async () => {
        findFirst.mockResolvedValue(null);
        await expect(service.getUserServer(4, 99)).rejects.toThrow(NotFoundException);
        expect(findFirst).toHaveBeenCalledWith({ where: { id: 4, userId: 99 } });
    });

    it('does not create a server when merely listing or reading servers', async () => {
        findMany.mockResolvedValue([]);
        findFirst.mockResolvedValue({ id: 4, userId: 11 });
        await service.getUserServers(11);
        await service.getUserServer(4, 11);
        expect(create).not.toHaveBeenCalled();
    });

    it('assigns a new server to the explicitly provided owner', async () => {
        const server = { id: 7, userId: 42, name: 'Production' };
        create.mockResolvedValue(server);
        await expect(service.createServer(42, '  Production  ')).resolves.toBe(server);
        expect(create).toHaveBeenCalledWith({
            data: { name: 'Production', userId: 42 },
        });
    });

    it('sends an invitation only to the requested user', async () => {
        const notification = { id: 9, userId: 42 };
        createNotification.mockResolvedValue(notification);
        await service.inviteUser(42);
        expect(createNotification).toHaveBeenCalledWith(
            42,
            'Zostałeś zaproszony do serwera',
        );
        expect(sendToUser).toHaveBeenCalledWith(42, notification);
    });

    it('does not emit an invitation when notification creation fails', async () => {
        createNotification.mockRejectedValue(new Error('Database unavailable'));
        await expect(service.inviteUser(42)).rejects.toThrow('Database unavailable');
        expect(sendToUser).not.toHaveBeenCalled();
    });
});
